import ARKit
import Capacitor
import SceneKit
import UIKit

/// Face ID-style skin scan using the iPhone TrueDepth (Face ID) camera.
/// The website calls Capacitor.Plugins.FaceScan.scan() when it runs inside the SuperYou app; the result is
/// three photos (front + both sides) plus the face distance and light measured by the depth camera.
@objc(FaceScanPlugin)
public class FaceScanPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FaceScanPlugin"
    public let jsName = "FaceScan"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": ARFaceTrackingConfiguration.isSupported])
    }

    @objc func scan(_ call: CAPPluginCall) {
        guard ARFaceTrackingConfiguration.isSupported else {
            call.reject("unsupported")
            return
        }
        DispatchQueue.main.async {
            let vc = FaceScanViewController()
            vc.modalPresentationStyle = .fullScreen
            vc.onFinish = { result in
                vc.dismiss(animated: true) {
                    if let result = result { call.resolve(result) } else { call.reject("cancelled") }
                }
            }
            self.bridge?.viewController?.present(vc, animated: true)
        }
    }
}

final class FaceScanViewController: UIViewController, ARSCNViewDelegate, ARSessionDelegate {
    var onFinish: (([String: Any]?) -> Void)?

    private let sceneView = ARSCNView()
    private let label = UILabel()
    private let percent = UILabel()
    private var ticks: [CAShapeLayer] = []
    private var lit = [Bool](repeating: false, count: 60)
    private var faceNode: SCNNode?

    private var front: String?
    private var sideA: String?
    private var sideB: String?
    private var steady = 0
    private var startedAt: Date?
    private var doneAt: Date?
    private var finished = false
    private var distances: [Float] = []
    private var lights: [CGFloat] = []
    private var temps: [CGFloat] = []
    private let haptic = UIImpactFeedbackGenerator(style: .medium)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        sceneView.frame = view.bounds
        sceneView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        sceneView.delegate = self
        sceneView.session.delegate = self
        sceneView.automaticallyUpdatesLighting = true
        view.addSubview(sceneView)

        let dim = UIView(frame: view.bounds)
        dim.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        dim.backgroundColor = UIColor.black.withAlphaComponent(0.25)
        dim.isUserInteractionEnabled = false
        view.addSubview(dim)

        label.textColor = .white
        label.font = .systemFont(ofSize: 22, weight: .semibold)
        label.textAlignment = .center
        label.numberOfLines = 2
        label.text = "Look straight at the screen"
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)

        percent.textColor = UIColor.white.withAlphaComponent(0.7)
        percent.font = .systemFont(ofSize: 15, weight: .regular)
        percent.textAlignment = .center
        percent.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(percent)

        let close = UIButton(type: .system)
        close.setTitle("✕", for: .normal)
        close.titleLabel?.font = .systemFont(ofSize: 22, weight: .semibold)
        close.tintColor = .white
        close.backgroundColor = UIColor.white.withAlphaComponent(0.15)
        close.layer.cornerRadius = 22
        close.translatesAutoresizingMaskIntoConstraints = false
        close.addTarget(self, action: #selector(cancel), for: .touchUpInside)
        close.accessibilityLabel = "Close"
        view.addSubview(close)

        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            label.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            label.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -90),
            percent.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 8),
            percent.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            close.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            close.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            close.widthAnchor.constraint(equalToConstant: 44),
            close.heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        guard ticks.isEmpty else { return }
        let c = CGPoint(x: view.bounds.midX, y: view.bounds.height * 0.42)
        let rx = view.bounds.width * 0.40, ry = rx * 1.32
        for i in 0..<lit.count {
            let a = CGFloat(i) / CGFloat(lit.count) * .pi * 2
            let p1 = CGPoint(x: c.x + cos(a) * (rx + 8), y: c.y + sin(a) * (ry + 8))
            let p2 = CGPoint(x: c.x + cos(a) * (rx + 22), y: c.y + sin(a) * (ry + 22))
            let path = UIBezierPath()
            path.move(to: p1)
            path.addLine(to: p2)
            let t = CAShapeLayer()
            t.path = path.cgPath
            t.lineWidth = 4
            t.lineCap = .round
            t.strokeColor = UIColor.white.withAlphaComponent(0.35).cgColor
            view.layer.addSublayer(t)
            ticks.append(t)
        }
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        let config = ARFaceTrackingConfiguration()
        config.isLightEstimationEnabled = true
        sceneView.session.run(config, options: [.resetTracking, .removeExistingAnchors])
        haptic.prepare()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        sceneView.session.pause()
    }

    @objc private func cancel() {
        guard !finished else { return }
        finished = true
        onFinish?(nil)
    }

    // Live 3D face mesh from the TrueDepth camera.
    func renderer(_ renderer: SCNSceneRenderer, nodeFor anchor: ARAnchor) -> SCNNode? {
        guard anchor is ARFaceAnchor, let device = sceneView.device, let geo = ARSCNFaceGeometry(device: device) else { return nil }
        geo.firstMaterial?.fillMode = .lines
        geo.firstMaterial?.lightingModel = .constant
        geo.firstMaterial?.diffuse.contents = UIColor(red: 1, green: 0.68, blue: 0.82, alpha: 0.85)
        let node = SCNNode(geometry: geo)
        faceNode = node
        return node
    }

    func renderer(_ renderer: SCNSceneRenderer, didUpdate node: SCNNode, for anchor: ARAnchor) {
        guard let face = anchor as? ARFaceAnchor, let geo = node.geometry as? ARSCNFaceGeometry else { return }
        geo.update(from: face.geometry)
    }

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        guard !finished else { return }
        if let done = doneAt {
            if Date().timeIntervalSince(done) > 1.0 { finish() }
            return
        }
        guard let face = frame.anchors.compactMap({ $0 as? ARFaceAnchor }).first, face.isTracked else {
            label.text = "Fit your face inside the circle"
            return
        }
        // Head pose and distance relative to the camera (the depth sensor gives real centimetres).
        let rel = simd_mul(simd_inverse(frame.camera.transform), face.transform)
        let fwd = rel.columns.2
        let yaw = atan2(fwd.x, fwd.z)
        let pitch = atan2(-fwd.y, fwd.z)
        let cm = -rel.columns.3.z * 100
        let light = frame.lightEstimate?.ambientIntensity ?? 1000
        let temp = frame.lightEstimate?.ambientColorTemperature ?? 6500

        if front == nil {
            if cm > 45 { label.text = "Move a little closer"; steady = 0; return }
            if cm < 22 { label.text = "Move the phone back a little"; steady = 0; return }
            if light < 350 { label.text = "Too dark: face a window or a light"; steady = 0; return }
            if abs(yaw) > 0.12 || abs(pitch) > 0.12 { label.text = "Look straight at the screen"; steady = 0; return }
            steady += 1
            label.text = "Hold still…"
            if steady > 15, let shot = photo() {
                front = shot
                startedAt = Date()
                haptic.impactOccurred()
                label.text = "Now slowly move your head in a circle"
            }
            return
        }

        distances.append(cm)
        lights.append(light)
        temps.append(temp)
        let mag = hypot(yaw, pitch)
        if mag > 0.15 {
            let ang = (atan2(pitch, -yaw) + .pi * 2).truncatingRemainder(dividingBy: .pi * 2)
            let i = Int(((ang / (.pi * 2)) * Float(lit.count)).rounded()) % lit.count
            for k in -2...2 {
                let j = (i + k + lit.count) % lit.count
                if !lit[j] {
                    lit[j] = true
                    ticks[j].strokeColor = UIColor(hue: (0.92 + CGFloat(j) / CGFloat(lit.count) * 0.17).truncatingRemainder(dividingBy: 1), saturation: 0.6, brightness: 1, alpha: 1).cgColor
                }
            }
        }
        if yaw > 0.38, sideA == nil, let shot = photo() { sideA = shot; haptic.impactOccurred() }
        if yaw < -0.38, sideB == nil, let shot = photo() { sideB = shot; haptic.impactOccurred() }
        let n = lit.filter { $0 }.count
        percent.text = "\(n * 100 / lit.count)%"
        let enough = Double(n) / Double(lit.count) >= 0.7 && sideA != nil && sideB != nil
        if enough || Date().timeIntervalSince(startedAt ?? Date()) > 25 {
            doneAt = Date()
            ticks.forEach { $0.strokeColor = UIColor.systemGreen.cgColor }
            percent.text = "100%"
            label.text = "Scan complete ✓"
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }

    /// A clean photo of the face (mesh hidden), cropped to 3:4 portrait and sized for the AI.
    private func photo() -> String? {
        faceNode?.isHidden = true
        let img = sceneView.snapshot()
        faceNode?.isHidden = false
        let w = img.size.width, h = img.size.height
        let cw = min(w, h * 3 / 4), ch = cw * 4 / 3
        let crop = CGRect(x: (w - cw) / 2, y: max(0, (h - ch) / 2 - h * 0.05), width: cw, height: min(ch, h))
        let scale = min(1, 900 / crop.height)
        let size = CGSize(width: crop.width * scale, height: crop.height * scale)
        let out = UIGraphicsImageRenderer(size: size).image { _ in
            img.draw(in: CGRect(x: -crop.minX * scale, y: -crop.minY * scale, width: w * scale, height: h * scale))
        }
        guard let data = out.jpegData(compressionQuality: 0.85) else { return nil }
        return "data:image/jpeg;base64," + data.base64EncodedString()
    }

    private func finish() {
        guard !finished, let front = front else { return }
        finished = true
        let avg: ([Float]) -> Float = { $0.isEmpty ? 0 : $0.reduce(0, +) / Float($0.count) }
        let avgC: ([CGFloat]) -> CGFloat = { $0.isEmpty ? 0 : $0.reduce(0, +) / CGFloat($0.count) }
        onFinish?([
            "front": front,
            "sides": [sideA, sideB].compactMap { $0 },
            "depth": true,
            "distanceCm": Int(avg(distances).rounded()),
            "light": Int(avgC(lights).rounded()),
            "colorTemp": Int(avgC(temps).rounded()),
        ])
    }
}

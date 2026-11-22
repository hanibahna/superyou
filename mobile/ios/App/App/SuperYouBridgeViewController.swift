import Capacitor
import UIKit

/// The app's web view, with the SuperYou native plugins registered (Face ID 3D skin scan).
class SuperYouBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(FaceScanPlugin())
    }
}

# Applies the UX audit to the built-in homepage & menu (data/seed-site.json).
import json, sys
p = sys.argv[1]
d = json.load(open(p))
L = d['landing']['sections']
types = [s['type'] for s in L]
# 1) max 4 product rows: switch off the 2nd "Best sellers" (fragrance) row
rows = [s for s in L if s['type'] == 'products']
if len(rows) >= 5: rows[3]['enabled'] = False
# 2) Shop by concern after the category circles
if 'concerns' not in types:
    i = types.index('circles') + 1
    L.insert(i, {"id": "concerns", "type": "concerns", "enabled": True, "eyebrow": "Pharmacist-picked", "title": "Shop by concern"})
# 3) Smart beauty tools (signature features) after the offers block
if not any(s['id'] == 'tools' for s in L):
    offer_imgs = [it['image'] for s in L if s['type'] == 'offers' for it in s['items']] + [it['image'] for s in L if s['type'] == 'bfhero' for it in s['images']]
    img = lambda n: offer_imgs[n % len(offer_imgs)] if offer_imgs else ""
    tools = {"id": "tools", "type": "offers", "enabled": True, "eyebrow": "Pharmacist-approved", "title": "Your beauty, expertly matched", "items": [
        {"image": img(4), "title": "AI skin scan", "text": "A selfie, then a routine built from what's in stock", "cta": "Scan my skin", "href": "/skin-scan/", "bg": "#f3ecf4", "badge": "New"},
        {"image": img(1), "title": "Foundation shade finder", "text": "5 questions to your shade range and formula", "cta": "Find my shade", "href": "/shade-finder/", "bg": "#f6f2ee", "badge": ""},
        {"image": img(2), "title": "Routine finder", "text": "Morning and evening routine for your skin, with a set discount", "cta": "Build my routine", "href": "/routine/", "bg": "#eef3f6", "badge": ""},
        {"image": img(3), "title": "SuperYou Club", "text": "Points on every order, birthday gift, VIP events", "cta": "Join free", "href": "/club/", "bg": "#eef5ee", "badge": "Free"},
    ]}
    L.insert([s['type'] for s in L].index('offers') + 1, tools)
# 3b) Campaign banner: products gliding left
for s in L:
    if s['type']=='bfhero': s['slider']={'enabled':True,'source':{'kind':'sale','value':''},'limit':16,'interval':3.5}
# 4) Videos with products under each clip
for s in L:
    if s['type'] == 'social' and s.get('source') == 'library': s['display'] = 'shoppable'
# 5) Leaner top menu
M = d['settings']['menu']
by = {m['label']: m for m in M}
if 'Bath & Body' in by and 'Baby & Mom' in by:
    body = by['Bath & Body']
    body['label'] = 'Body & Baby'
    body['children'] = body.get('children', []) + [{"label": "Baby & Mom", "href": by['Baby & Mom']['href'], "children": by['Baby & Mom'].get('children', [])[:12]}]
    M.remove(by['Baby & Mom'])
if 'Tools' in by and 'Make Up' in by:
    by['Make Up'].setdefault('children', []).append({"label": "Tools & brushes", "href": by['Tools']['href'], "children": by['Tools'].get('children', [])[:12]})
    M.remove(by['Tools'])
if 'Value Deals' in by: by['Value Deals']['label'] = 'Offers'; by['Value Deals']['highlight'] = True
order = ['Offers', 'Skin Care', 'Make Up', 'Hair Expert', 'Fragrances', 'Body & Baby', 'Parapharmacy', 'Brands', 'Services & Events']
M.sort(key=lambda m: order.index(m['label']) if m['label'] in order else 99)
if any(m['label'] == 'Services & Events' for m in M):
    svc = next(m for m in M if m['label'] == 'Services & Events'); M.remove(svc)
    d['settings'].setdefault('footerMenu', [])
d['settings']['announcement'] = d['settings'].get('announcement', {})
json.dump(d, open(p, 'w'), ensure_ascii=False)
print([m['label'] for m in M], [ (s['type'], s.get('enabled')) for s in L])

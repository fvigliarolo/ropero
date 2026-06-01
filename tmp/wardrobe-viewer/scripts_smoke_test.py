import json
import urllib.request

with urllib.request.urlopen('http://127.0.0.1:4782/api/items', timeout=30) as r:
    obj = json.load(r)
print('count=', obj.get('count'))
items = obj.get('items', [])
if items:
    print('first=', items[0].get('title'))
    print('brand=', items[0].get('brand'))

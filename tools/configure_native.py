"""Apply idempotent app-link, icon and transport settings to cap-generated projects.
Does not create signing keys, upload apps, purchase anything or change databases.
"""
from pathlib import Path
import json
import os
import plistlib
import re
import shutil
import sys
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]
A='{http://schemas.android.com/apk/res/android}'
ET.register_namespace('android',A[1:-1])


def configure_android(root:Path,origin:str):
    manifest=root/'android/app/src/main/AndroidManifest.xml'
    tree=ET.parse(manifest);app=tree.getroot().find('application')
    if app is None:raise ValueError('Android application not found.')
    app.set(A+'allowBackup','false');app.set(A+'usesCleartextTraffic','false')
    app.set(A+'icon','@mipmap/ic_launcher');app.set(A+'roundIcon','@mipmap/ic_launcher_round')
    activity=next((n for n in app.findall('activity') if n.get(A+'name','').endswith('MainActivity')),None)
    if activity is None:raise ValueError('Android MainActivity not found.')
    for node in list(activity):
        if node.tag=='intent-filter' and node.get(A+'label')=='Nabu verified links':activity.remove(node)
    if origin:
        links=ET.SubElement(activity,'intent-filter',{A+'autoVerify':'true',A+'label':'Nabu verified links'})
        ET.SubElement(links,'action',{A+'name':'android.intent.action.VIEW'})
        for category in ('DEFAULT','BROWSABLE'):ET.SubElement(links,'category',{A+'name':'android.intent.category.'+category})
        for route in ('/w/','/review','/friends','/library','/read','/words'):
            ET.SubElement(links,'data',{A+'scheme':'https',A+'host':urlparse(origin).hostname,A+('pathPrefix' if route.endswith('/') else 'path'):route})
    ET.indent(tree);tree.write(manifest,encoding='utf-8',xml_declaration=True)
    resources=root/'android/app/src/main/res'
    shutil.copytree(root/'mobile/assets/android',resources,dirs_exist_ok=True)
    (resources/'drawable').mkdir(exist_ok=True)
    shutil.copyfile(root/'mobile/assets/splash.png',resources/'drawable/splash.png')


def configure_ios(root:Path,origin:str):
    folder=root/'ios/App/App';info=folder/'Info.plist'
    data=plistlib.loads(info.read_bytes())
    data['CFBundleDisplayName']='Nabu'
    # No arbitrary loads or ATS exceptions. Backend requests must use HTTPS.
    if data.get('NSAppTransportSecurity',{}).get('NSAllowsArbitraryLoads'):
        raise ValueError('Remove NSAllowsArbitraryLoads before preparing a release.')
    if origin:data['WKAppBoundDomains']=['localhost',urlparse(origin).hostname]
    else:data.pop('WKAppBoundDomains',None)
    info.write_bytes(plistlib.dumps(data))
    entitlement=folder/'Nabu.entitlements'
    ent=plistlib.loads(entitlement.read_bytes()) if entitlement.exists() else {}
    if origin:ent['com.apple.developer.associated-domains']=['applinks:'+urlparse(origin).hostname]
    else:ent.pop('com.apple.developer.associated-domains',None)
    entitlement.write_bytes(plistlib.dumps(ent))
    project=root/'ios/App/App.xcodeproj/project.pbxproj'
    text=project.read_text()
    if 'CODE_SIGN_ENTITLEMENTS = App/Nabu.entitlements;' not in text:
        text=re.sub(r'(\bPRODUCT_BUNDLE_IDENTIFIER = [^;]+;)',r'CODE_SIGN_ENTITLEMENTS = App/Nabu.entitlements;\n\t\t\t\t\1',text)
    project.write_text(text)
    shutil.copyfile(root/'mobile/PrivacyInfo.xcprivacy',root/'ios/App/PrivacyInfo.xcprivacy')
    print('iOS: add PrivacyInfo.xcprivacy to the App target resources and audit final privacy disclosures before submission.')
    icons=folder/'Assets.xcassets/AppIcon.appiconset';icons.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(root/'mobile/assets/icon-1024.png',icons/'AppIcon-1024.png')
    (icons/'Contents.json').write_text(json.dumps({'images':[{'filename':'AppIcon-1024.png','idiom':'universal','platform':'ios','size':'1024x1024'}],'info':{'author':'xcode','version':1}},indent=2)+'\n')
    splash=folder/'Assets.xcassets/Splash.imageset';splash.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(root/'mobile/assets/splash.png',splash/'splash.png')
    (splash/'Contents.json').write_text(json.dumps({'images':[{'filename':'splash.png','idiom':'universal','scale':'1x'}],'info':{'author':'xcode','version':1}},indent=2)+'\n')


def main():
    info=ROOT/'mobile/build-info.json'
    if not info.exists():raise ValueError('Run npm run mobile:prepare first.')
    origin=json.loads(info.read_text())['apiOrigin']
    if origin:
        u=urlparse(origin)
        if u.scheme!='https' or not u.hostname or u.path or u.query or u.fragment or u.username or u.password:raise ValueError('Invalid backend origin.')
    selected=sys.argv[1:] or ['android','ios'];found=False
    for platform in selected:
        if platform not in ('android','ios'):raise ValueError('Use android or ios.')
        if not (ROOT/platform).exists():continue
        (configure_android if platform=='android' else configure_ios)(ROOT,origin)
        print('Configured '+platform+' assets and verified-link declarations. Signing is still required.');found=True
    if not found:raise ValueError('No generated native project. Run npm run mobile:init -- android (or ios on macOS).')

if __name__=='__main__':
    try:main()
    except (ValueError,FileNotFoundError,KeyError) as error:
        print(str(error),file=sys.stderr);sys.exit(1)

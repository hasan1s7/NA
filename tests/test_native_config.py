"""Representative native-project fixtures, not an SDK compile or device test."""
import json,plistlib,shutil
from pathlib import Path
import xml.etree.ElementTree as ET
import pytest
from tools.configure_native import configure_android,configure_ios,A
ROOT=Path(__file__).resolve().parents[1]

@pytest.fixture
def native(tmp_path):
    shutil.copytree(ROOT/'mobile/assets',tmp_path/'mobile/assets')
    shutil.copyfile(ROOT/'mobile/PrivacyInfo.xcprivacy',tmp_path/'mobile/PrivacyInfo.xcprivacy')
    manifest=tmp_path/'android/app/src/main/AndroidManifest.xml';manifest.parent.mkdir(parents=True)
    manifest.write_text('<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:allowBackup="true"><activity android:name=".MainActivity"><intent-filter><action android:name="android.intent.action.MAIN"/></intent-filter></activity></application></manifest>')
    folder=tmp_path/'ios/App/App';folder.mkdir(parents=True);(folder/'Info.plist').write_bytes(plistlib.dumps({'CFBundleName':'App'}))
    project=tmp_path/'ios/App/App.xcodeproj/project.pbxproj';project.parent.mkdir();project.write_text('Debug { PRODUCT_BUNDLE_IDENTIFIER = app.nabu.learn; }\nRelease { PRODUCT_BUNDLE_IDENTIFIER = app.nabu.learn; }')
    return tmp_path


def test_android_configuration_is_idempotent_and_preserves_launcher(native):
    for _ in range(2):configure_android(native,'https://nabu.example')
    tree=ET.parse(native/'android/app/src/main/AndroidManifest.xml');app=tree.getroot().find('application');activity=app.find('activity')
    assert app.get(A+'allowBackup')=='false' and app.get(A+'usesCleartextTraffic')=='false'
    assert len(activity.findall('intent-filter'))==2
    links=[n for n in activity.findall('intent-filter') if n.get(A+'autoVerify')=='true'][0]
    assert all(n.get(A+'host')=='nabu.example' for n in links.findall('data'))
    assert (native/'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png').exists()


def test_android_offline_build_removes_previous_verified_link_configuration(native):
    configure_android(native,'https://nabu.example');configure_android(native,'')
    activity=ET.parse(native/'android/app/src/main/AndroidManifest.xml').getroot().find('application/activity')
    assert len(activity.findall('intent-filter'))==1


def test_ios_configuration_preserves_other_entitlements_and_is_idempotent(native):
    ent=native/'ios/App/App/Nabu.entitlements';ent.write_bytes(plistlib.dumps({'example-existing':True}))
    for _ in range(2):configure_ios(native,'https://nabu.example')
    data=plistlib.loads(ent.read_bytes());assert data['example-existing'] is True
    assert data['com.apple.developer.associated-domains']==['applinks:nabu.example']
    project=(native/'ios/App/App.xcodeproj/project.pbxproj').read_text();assert project.count('CODE_SIGN_ENTITLEMENTS')==2
    info=plistlib.loads((native/'ios/App/App/Info.plist').read_bytes());assert info['WKAppBoundDomains']==['localhost','nabu.example']
    assert 'NSAppTransportSecurity' not in info
    icons=json.loads((native/'ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json').read_text());assert icons['images'][0]['size']=='1024x1024'


def test_ios_refuses_arbitrary_network_loads(native):
    path=native/'ios/App/App/Info.plist';path.write_bytes(plistlib.dumps({'NSAppTransportSecurity':{'NSAllowsArbitraryLoads':True}}))
    with pytest.raises(ValueError,match='Arbitrary'):configure_ios(native,'https://nabu.example')


def test_ios_offline_configuration_removes_stale_domains(native):
    configure_ios(native,'https://nabu.example');configure_ios(native,'')
    assert 'com.apple.developer.associated-domains' not in plistlib.loads((native/'ios/App/App/Nabu.entitlements').read_bytes())
    assert 'WKAppBoundDomains' not in plistlib.loads((native/'ios/App/App/Info.plist').read_bytes())

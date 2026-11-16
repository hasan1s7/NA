import subprocess,json,sys,time
from pathlib import Path
root=Path(__file__).resolve().parents[2]
results=[]
for script in ["startup_browser.py","next_browser.py","bank_browser.py","mobile_links_browser.py","spatial_browser.py","local_release_browser.py","pages_package_browser.py"]:
    log=root/"verification/local"/(script+".log")
    start=time.time()
    with log.open("w") as out:
        try:
            proc=subprocess.run([sys.executable,str(root/"tests"/script)],cwd=root,stdout=out,stderr=subprocess.STDOUT,timeout=150)
            code=proc.returncode
        except subprocess.TimeoutExpired:
            code=124
    results.append({"script":script,"exitCode":code,"seconds":round(time.time()-start,2)})
    (root/"verification/local/ui-summary.json").write_text(json.dumps(results,indent=2))

"""Smoke-test the locally installed Safari if Remote Automation is already enabled."""
import json
import os
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[2]
preview = os.environ.get("PORTAL_DIAGNOSTIC_ORIGIN", "http://127.0.0.1:4399")
(root / "reports" / "hosting").mkdir(parents=True, exist_ok=True)
report = {"passed": False, "safaridriver": subprocess.check_output(
    ["/usr/bin/safaridriver", "--version"], text=True
).strip(), "target": preview + "/explore/"}
with socket.socket() as sock:
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
driver = subprocess.Popen(["/usr/bin/safaridriver", "-p", str(port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
origin = f"http://127.0.0.1:{port}"
sid = None

def command(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(origin+path, data=data, headers={"Content-Type":"application/json"}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=35) as response:
            return json.load(response)["value"]
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode()[:650]) from error

try:
    for i in range(30):
        try:
            command("GET", "/status")
            break
        except OSError:
            time.sleep(.2)
    session = command("POST","/session",{"capabilities":{"alwaysMatch":{"browserName":"safari"}}})
    sid = "/session/"+session["sessionId"]
    report["version"]=session["capabilities"].get("browserVersion")
    report["models"]=[]
    for model in ("raw","meshopt"):
        command("POST",sid+"/url",{"url":preview+"/explore/?inspect&theme=day&model="+model})
        command("POST",sid+"/execute/sync",{"script":"document.querySelector('[data-enable]:not([hidden])')?.click()","args":[]})
        for i in range(120):
            ready=command("POST",sid+"/execute/sync",{"script":"return !!window.__cv && !window.__cv.snapshot().moving","args":[]})
            if ready: break
            time.sleep(.25)
        assert ready
        command("POST",sid+"/execute/sync",{"script":"document.querySelector('[aria-label=切换昼夜]').click()","args":[]})
        value=command("POST",sid+"/execute/sync",{"script":"const s=window.__cv.snapshot();return [s.modelFile,s.theme,s.ids,s.modelCount]","args":[]})
        assert value[1:] == ["night",196,1], value
        report["models"].append(value)
    report["passed"]=True
except Exception as error:
    report["reason"]=str(error)
    print(report["reason"])
finally:
    try:
        if sid: command("DELETE",sid)
    finally:
        driver.terminate()
        driver.wait(timeout=8)
    (root/"reports"/"hosting"/"safari.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")

"""Exercise the installed release through its visible Android controls."""
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET


def adb(*args):
    return subprocess.check_output(["adb", *args], text=True, timeout=25)


def window():
    adb("shell", "uiautomator", "dump", "/sdcard/cuepatch-window.xml")
    return ET.fromstring(adb("exec-out", "cat", "/sdcard/cuepatch-window.xml"))


def labels(node):
    return [node.get(key, "").strip() for key in ("text", "content-desc")]


def locate(label):
    tree = window()
    for node in tree.iter("node"):
        if label in labels(node):
            bounds = list(map(int, re.findall(r"\d+", node.get("bounds", ""))))
            if len(bounds) == 4 and bounds[2] > bounds[0] and bounds[3] > bounds[1]:
                return (bounds[0] + bounds[2]) // 2, (bounds[1] + bounds[3]) // 2
    return None


screen = list(map(int, re.findall(r"(\d+)x(\d+)", adb("shell", "wm", "size"))[-1]))


def tap(label, scroll=False):
    for _ in range(8 if scroll else 3):
        point = locate(label)
        if point:
            adb("shell", "input", "tap", *map(str, point))
            return
        if scroll:
            x, y = screen
            adb("shell", "input", "swipe", str(x // 2), str(3*y//4),
                str(x // 2), str(y//3), "350")
    raise RuntimeError(f'Could not reach "{label}"')


def expect(label, seconds=24):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if locate(label):
            return
    raise RuntimeError(f'Expected "{label}"')


package = "app.riven.cuepatch"
if sys.argv[1] == "offline":
    tap("Caller")
    tap("Call 18:00 block", scroll=True)
    expect("Call 18:04 block")
    adb("shell", "am", "force-stop", package)
    adb("shell", "am", "start", "-W", "-n", package + "/.DeskActivity")
    tap("Caller")
    expect("Call 18:04 block")
    print("The first block stayed called after an offline restart.")
elif sys.argv[1] == "cloud":
    adb("shell", "cmd", "connectivity", "airplane-mode", "disable")
    adb("shell", "svc", "wifi", "enable")
    adb("shell", "svc", "data", "enable")
    adb("shell", "am", "force-stop", package)
    adb("shell", "am", "start", "-W", "-n", package + "/.DeskActivity")
    tap("Open navigation")
    tap("Live checks")
    tap("On-device only", scroll=True)
    tap("Allow cloud fallback")
    tap("Run live check", scroll=True)
    for _ in range(60):
        visible = [v for n in window().iter("node") for v in labels(n) if v]
        error = next((v for v in visible if v.startswith("Check stopped.")), None)
        if error:
            raise RuntimeError(error)
        if any("Live request finished." in v for v in visible):
            height = screen[1]
            adb("shell", "input", "swipe", str(screen[0]//2), str(3*height//4),
                str(screen[0]//2), str(height//3), "350")
            result = [v for n in window().iter("node") for v in labels(n) if v]
            source = next((v for v in result if "cloud" in v.lower() and "seconds" in v.lower()), None)
            if source:
                print("Firebase SDK:", source)
                print("Observed cue comparison:", [v for v in result if v.startswith(("Cue IDs", "Missed cues", "Unexpected cues"))])
                break
    else:
        raise RuntimeError("The release did not display a completed cloud response.")
else:
    raise ValueError("Choose offline or cloud")

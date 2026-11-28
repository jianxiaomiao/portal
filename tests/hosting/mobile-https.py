"""Preview the production root build over TLS for explicitly selected LAN devices."""
import argparse
import ipaddress
import ssl
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PRIVATE = [ipaddress.ip_network(value) for value in
           ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")]


def address(value):
    ip = ipaddress.IPv4Address(value)
    if ip.is_loopback or any(ip in network for network in PRIVATE):
        return ip
    raise argparse.ArgumentTypeError("Use a loopback or RFC 1918 IPv4 address.")


class Site(SimpleHTTPRequestHandler):
    def list_directory(self, path):
        self.send_error(404)

    def send_head(self):
        path = Path(self.translate_path(self.path)).resolve()
        if path.is_dir():
            path = path / "index.html"
        if path not in self.server.files:
            self.send_error(404)
            return None
        if path.name in self.server.missing:
            self.send_error(503, "Model unavailable in this test")
            return None
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


class Preview(ThreadingHTTPServer):
    def verify_request(self, request, peer):
        return ipaddress.IPv4Address(peer[0]) in self.allowed

    def process_request_thread(self, request, client_address):
        # Check the peer before TLS. A stalled handshake only occupies its own thread.
        try:
            request.settimeout(15)
            request = self.tls.wrap_socket(request, server_side=True)
        except OSError:
            request.close()
            return
        super().process_request_thread(request, client_address)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", type=address, default=address("127.0.0.1"))
    parser.add_argument("--allow", type=address, action="append", default=[])
    parser.add_argument("--port", type=int, default=8443)
    parser.add_argument("--cert", required=True, type=Path)
    parser.add_argument("--key", required=True, type=Path)
    parser.add_argument("--fail-model", choices=["meshopt", "both"])
    args = parser.parse_args()
    if not args.bind.is_loopback and not args.allow:
        parser.error("A LAN preview needs at least one --allow PHONE_IP.")
    root = Path(__file__).resolve().parents[2] / "dist"
    if not (root / "index.html").is_file() or not (root / "explore/index.html").is_file():
        parser.error("Build the production root into dist first.")
    files = {p for p in root.rglob("*") if p.is_file()}
    if any(p.resolve() != p for p in files) or any(
        p.resolve().is_relative_to(root) for p in (args.cert, args.key)
    ):
        parser.error("Use a build without symlinks and TLS files outside dist.")
    if any("__cv" in p.read_text() for p in (root / "assets").glob("*.js")):
        parser.error("This preview requires the RC production bundle.")
    if any(p.name != "THIRD-PARTY-NOTICES.txt" and p.suffix not in {".js", ".css", ".html", ".glb", ".json", ".svg", ".webp", ".jpg", ".png"} for p in files):
        parser.error("Unexpected file in production build.")
    tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    tls.minimum_version = ssl.TLSVersion.TLSv1_2
    tls.load_cert_chain(args.cert, args.key)
    with Preview((str(args.bind), args.port), partial(Site, directory=root)) as server:
        server.allowed = set(args.allow) | {args.bind, address("127.0.0.1")}
        server.files = files
        server.missing = {"Town.meshopt.glb"} if args.fail_model else set()
        if args.fail_model == "both":
            server.missing.add("Town.glb")
        server.tls = tls
        print(f"https://{args.bind}:{args.port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()

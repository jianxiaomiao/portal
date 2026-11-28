"""Serve the root and Pages builds side by side with an unprivileged local Nginx."""

import argparse
import os
import shutil
import tempfile
from pathlib import Path


def asset_location(prefix, directory):
    return f'''
        location {prefix} {{
            alias "{directory}{'/' if prefix.endswith('/') else ''}";
            add_header Cache-Control "public, max-age=31536000, immutable";
        }}
    '''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--nginx", default=shutil.which("nginx"))
    parser.add_argument("--port", type=int, default=4398)
    args = parser.parse_args()
    if not args.nginx:
        parser.error("Supply an nginx executable with --nginx.")

    project = Path(__file__).resolve().parents[2]
    root = project / "dist"
    pages = project / "dist-pages"
    state = Path(tempfile.mkdtemp(prefix="portal-preview-"))
    (state / "logs").mkdir()
    config = state / "nginx.conf"
    config.write_text(f'''
        daemon off;
        worker_processes 1;
        error_log "{state}/logs/error.log";
        pid "{state}/nginx.pid";
        events {{ worker_connections 256; }}
        http {{
            access_log off;
            types {{
                text/html html;
                text/css css;
                application/javascript js mjs;
                application/json json;
                image/webp webp;
                image/jpeg jpg jpeg;
                image/png png;
                image/svg+xml svg;
                image/x-icon ico;
                model/gltf-binary glb;
                application/wasm wasm;
            }}
            default_type application/octet-stream;
            server {{
                listen 127.0.0.1:{args.port};
                server_name localhost;
                root "{root}";
                index index.html;
                etag on;
                add_header Cache-Control "no-cache";
                error_page 404 /404.html;
                location /portal/ {{
                    alias "{pages}/";
                    error_page 404 /portal/404.html;
                }}
                {asset_location('/assets/', root / 'assets')}
                {asset_location('/portal/assets/', pages / 'assets')}
                {asset_location('/media-', root / 'media-')}
                {asset_location('/portal/media-', pages / 'media-')}
                {asset_location('/town-', root / 'town-')}
                {asset_location('/portal/town-', pages / 'town-')}
            }}
        }}
    ''')
    print(f"Portal preview: http://127.0.0.1:{args.port}/", flush=True)
    os.execl(args.nginx, args.nginx, "-p", f"{state}/", "-c", str(config))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Custom HTTP server with no-cache headers for development.
Run this instead of `python3 -m http.server` to disable caching.
"""
import http.server
import socketserver
import os
import sys
from pathlib import Path

PORT = int(os.getenv('PORT', 8080))
ROOT_DIR = str(Path(__file__).parent.parent)  # Parent of bf_foot_dashboard

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add no-cache headers to all responses
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def translate_path(self, path):
        # Serve from ROOT_DIR instead of current directory
        path = super().translate_path(path)
        relpath = os.path.relpath(path, os.getcwd())
        return os.path.join(ROOT_DIR, relpath)

def run():
    os.chdir(ROOT_DIR)
    with socketserver.TCPServer(("", PORT), NoCacheHTTPRequestHandler) as httpd:
        print(f"Serving {ROOT_DIR} on port {PORT}")
        print(f"URL: http://localhost:{PORT}/bf_foot_dashboard")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down...")
            sys.exit(0)

if __name__ == '__main__':
    run()

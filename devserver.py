# Local test server (run webserver.bat, then open http://localhost:8000).
# Like "python -m http.server", but tells the browser never to cache, so
# edited scripts always load fresh instead of an old copy.
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
print("Serving on http://localhost:%d (no caching)" % port)
http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()

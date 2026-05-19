"""
ASGI config for MockWar_backend project.
"""

import os
from django.core.asgi import get_asgi_application

# 1. Django Setup (इसे ऊपर ही रखना ज़रूरी है)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'MockWar_backend.settings')
django_asgi_app = get_asgi_application()

# 2. Channels Imports (Django setup होने के बाद)
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

# 3. Game App Routing (यह फाइल हम अगले स्टेप में बनाएंगे)
from core_game.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app, # नॉर्मल API रिक्वेस्ट्स यहाँ जाएंगी
    "websocket": AuthMiddlewareStack(
        URLRouter(
            websocket_urlpatterns # लाइव गेमिंग डेटा (WebSockets) यहाँ जाएगा
        )
    ),
})
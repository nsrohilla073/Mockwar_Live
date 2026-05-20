# core_game/routing.py

from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # 🔥 NAYA: Ab URL me table_slug ke sath room_id bhi aayegi (2 logon ka private room)
    re_path(r'ws/arena/(?P<table_slug>[-\w]+)/(?P<room_id>[-\w]+)/$', consumers.GameConsumer.as_asgi()),
]
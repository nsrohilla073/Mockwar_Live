# core_game/routing.py

from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/arena/(?P<table_id>\d+)/(?P<room_id>[-\w]+)/$', consumers.GameConsumer.as_asgi()),
]
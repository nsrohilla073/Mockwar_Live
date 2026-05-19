from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # 🔥 जब फ्रंटएंड 'ws://127.0.0.1:8000/ws/arena/haryana-gk/' पर कॉल करेगा, तो यह उसे गेम रूम में डाल देगा
    re_path(r'ws/arena/(?P<table_slug>[-\w]+)/$', consumers.GameConsumer.as_asgi()),
]
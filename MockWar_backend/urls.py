from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('mockwar_boss_area_99/', admin.site.urls),
    path('api/', include('core_game.urls')),  # ध्यान दें: यहाँ सिर्फ 'core_game.urls' होना चाहिए
]
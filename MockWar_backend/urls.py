from django.contrib import admin
from django.urls import path, include

# 🌟 CUSTOM ADMIN TEXT
admin.site.site_header = "MOCKWAR ESPORTS ADMIN"
admin.site.site_title = "MockWar Secure Portal"
admin.site.index_title = "Welcome to MockWar Command Center"


urlpatterns = [
    path('mockwar_boss_area_99/', admin.site.urls),
    path('api/', include('core_game.urls')),  
]
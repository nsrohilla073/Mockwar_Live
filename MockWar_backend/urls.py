from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('mockwar_boss_area_99/', admin.site.urls),
    path('api/', include('core_game.urls')),  
]
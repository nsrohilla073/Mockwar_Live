# core_game/apps.py

from django.apps import AppConfig

class CoreGameConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core_game'

    def ready(self):
        import core_game.signals  # <-- यह हमारे सिग्नल को लोड करेगा
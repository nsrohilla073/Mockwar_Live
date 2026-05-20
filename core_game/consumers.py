import json
from channels.generic.websocket import AsyncWebsocketConsumer
from django.core.cache import cache
from channels.db import database_sync_to_async

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.table_slug = self.scope['url_route']['kwargs']['table_slug']
        self.room_group_name = f'arena_{self.table_slug}'

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        user = self.scope.get('user')
        if user and user.is_authenticated:
            self.gamer_tag = user.profile.gamer_tag if hasattr(user, 'profile') else user.username
        else:
            self.gamer_tag = "Live_Player"

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_message',
                'action': 'player_joined',
                'player': self.gamer_tag
            }
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_message',
                'action': 'player_left',
                'player': self.gamer_tag
            }
        )

    # 🎮 जब फ्रंटएंड से कोई डेटा आता है
    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')

        # 1. लाइव स्कोर अपडेट (खेलते समय)
        if action == 'score_update':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_message',
                    'action': 'score_update',
                    'player': data.get('player_name', self.gamer_tag),
                    'score': data.get('score', 0)
                }
            )

        # 2. 🚨 असली जज (Referee) का काम यहाँ शुरू होता है 🚨
        elif action == 'game_finished':
            player_name = data.get('player_name', self.gamer_tag)
            final_score = int(data.get('score', 0))
            wpm = int(data.get('wpm', 0))

            await self.process_game_finish(player_name, final_score, wpm)

    # Database/Cache को Async में चलाने के लिए सुरक्षित तरीके
    @database_sync_to_async
    def get_cache(self, key):
        return cache.get(key, {})

    @database_sync_to_async
    def set_cache(self, key, value, timeout):
        cache.set(key, value, timeout)

    @database_sync_to_async
    def delete_cache(self, key):
        cache.delete(key)

    # ⚖️ स्कोर कम्पेयर करने का लॉजिक
    async def process_game_finish(self, player_name, final_score, wpm):
        cache_key = f"match_state_{self.room_group_name}"
        
        state = await self.get_cache(cache_key)
        if not state:
            state = {'players': {}}

        # प्लेयर का स्कोर लॉक कर दो
        state['players'][player_name] = {'score': final_score, 'wpm': wpm}
        await self.set_cache(cache_key, state, 120)

        # क्या दोनों प्लेयर्स ने गेम सबमिट कर दिया है?
        if len(state['players']) >= 2:
            players_list = list(state['players'].items())
            p1_name, p1_data = players_list[0]
            p2_name, p2_data = players_list[1]

            # फैसला करो: कौन जीता?
            winners = []
            losers = []

            # पहले स्कोर देखो
            if p1_data['score'] > p2_data['score']:
                winners.append(p1_name)
                losers.append(p2_name)
            elif p2_data['score'] > p1_data['score']:
                winners.append(p2_name)
                losers.append(p1_name)
            else:
                # अगर स्कोर बराबर है, तो टाइपिंग स्पीड (WPM) देखो
                if p1_data['wpm'] > p2_data['wpm']:
                    winners.append(p1_name)
                    losers.append(p2_name)
                elif p2_data['wpm'] > p1_data['wpm']:
                    winners.append(p2_name)
                    losers.append(p1_name)
                # अगर दोनों सेम हैं, तो DRAW (खाली लिस्ट)

            # दोनों मोबाइल्स को एक साथ रिजल्ट भेज दो!
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_message',
                    'action': 'match_result',
                    'winners': winners,
                    'losers': losers,
                    'is_draw': len(winners) == 0,
                    'final_scores': state['players']
                }
            )
            # सफाई कर दो ताकि अगला गेम खेला जा सके
            await self.delete_cache(cache_key)
            
        else:
            # अगर अभी एक ही प्लेयर का गेम ख़त्म हुआ है, तो उसे इंतज़ार करवाओ
            await self.send(text_data=json.dumps({
                'action': 'waiting_for_opponent',
                'message': 'Waiting for the other player to finish...'
            }))

    async def game_message(self, event):
        await self.send(text_data=json.dumps(event))
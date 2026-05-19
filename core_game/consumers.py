import json
from channels.generic.websocket import AsyncWebsocketConsumer

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # 1. URL से टेबल का नाम (slug) निकालो
        self.table_slug = self.scope['url_route']['kwargs']['table_slug']
        self.room_group_name = f'arena_{self.table_slug}'

        # 2. यूज़र को इस रूम के 'Group' में डाल दो
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        # 3. यूज़र का असली 'Gamer Tag' निकालो
        user = self.scope.get('user')
        if user and user.is_authenticated:
            # Note: Async context में database query सीधे नहीं कर सकते, 
            # लेकिन user object scope में होता है। 
            self.gamer_tag = user.username # सुरक्षित रखने के लिए username (UID) या डिफ़ॉल्ट नाम ले रहे हैं
        else:
            self.gamer_tag = "Live_Player"

        # 4. रूम में बैठे बाकी प्लेयर्स को बता दो कि "एक नया असली प्लेयर आ गया है!"
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_message',
                'action': 'player_joined',
                'player': self.gamer_tag
            }
        )

    async def disconnect(self, close_code):
        # यूज़र के जाते ही उसे रूम से निकाल दो
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        # बाकी प्लेयर्स को बता दो कि कोई भाग गया है (Optional)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_message',
                'action': 'player_left',
                'player': self.gamer_tag
            }
        )

    # 🎮 जब फ्रंटएंड से कोई डेटा (जैसे स्कोर) आता है
    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')

        if action == 'score_update':
            score = data.get('score', 0)
            player_name = data.get('player_name', self.gamer_tag)

            # यह स्कोर रूम में बैठे सब लोगों की स्क्रीन पर भेज दो!
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_message',
                    'action': 'score_update',
                    'player': player_name,
                    'score': score
                }
            )

    # 📡 जो डेटा ग्रुप से मिलता है, उसे वापस फ्रंटएंड (React) पर भेजना
    async def game_message(self, event):
        await self.send(text_data=json.dumps(event))
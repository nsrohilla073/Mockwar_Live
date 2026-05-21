import json
import random
import re
from channels.generic.websocket import AsyncWebsocketConsumer
from django.core.cache import cache
from channels.db import database_sync_to_async
from core_game.models import GameTable
from django.conf import settings
import google.generativeai as genai

@database_sync_to_async
def generate_ai_content(table_slug):
    try:
        table = GameTable.objects.filter(category__name__iexact=table_slug.replace('-', ' ')).first()
        if not table:
            table = GameTable.objects.first()
            
        q_count = table.questions_count if table else 5
        q_time = table.time_per_question if table else 12
        is_typing = 'typing' in table_slug.lower()
        
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        target_model_name = 'models/gemini-pro'
        for name in available_models:
            if 'gemini-1.5-flash' in name: target_model_name = name; break
            
        model = genai.GenerativeModel(target_model_name)

        if is_typing:
            topics = ["Space Exploration", "Cybersecurity", "Ancient Indian History"]
            prompt = f"Generate a unique single paragraph of exactly 40 words about '{random.choice(topics)}' for an English typing test. No markdown."
            res = model.generate_content(prompt)
            return {"is_typing_test": True, "paragraph": res.text.strip().replace('\n', ' ').replace('"', ''), "time_limit": 60}
        else:
            clean_topic = table.category.name if table else table_slug.replace('-', ' ')
            prompt = f"""
            Generate exactly {q_count} UNIQUE multiple choice quiz questions on the topic: "{clean_topic}".
            Question and options MUST be Bilingual (English / Hindi). 
            Return STRICTLY a JSON array. Format:
            [ {{"id": 1, "question": "Eng / Hin?", "options": ["A / ए", "B / बी", "C / सी", "D / डी"], "answer": "A"}} ]
            """
            res = model.generate_content(prompt)
            raw = res.text.strip()
            
            match = re.search(r'\[.*\]', raw, re.DOTALL)
            if match: raw = match.group(0)
            
            return {"is_typing_test": False, "questions": json.loads(raw), "time_per_question": q_time}
    except Exception as e:
        print("AI ERROR:", e)
        # 🔴 STRONG 5 QUESTIONS FALLBACK
        fallback_qs = [
            {"id":1, "question":"What is the capital of India? / भारत की राजधानी क्या है?", "options":["Mumbai / मुंबई", "New Delhi / नई दिल्ली", "Kolkata / कोलकाता", "Chennai / चेन्नई"], "answer":"B"},
            {"id":2, "question":"Which planet is known as the Red Planet? / लाल ग्रह किसे कहा जाता है?", "options":["Earth / पृथ्वी", "Venus / शुक्र", "Mars / मंगल", "Jupiter / बृहस्पति"], "answer":"C"},
            {"id":3, "question":"What is 15 + 25? / 15 + 25 क्या होता है?", "options":["30", "35", "40", "45"], "answer":"C"},
            {"id":4, "question":"Who wrote the Mahabharata? / महाभारत किसने लिखी थी?", "options":["Valmiki / वाल्मीकि", "Ved Vyas / वेद व्यास", "Tulsidas / तुलसीदास", "Kalidas / कालिदास"], "answer":"B"},
            {"id":5, "question":"What is the boiling point of water? / पानी का उबाल बिंदु क्या है?", "options":["50°C", "90°C", "100°C", "120°C"], "answer":"C"}
        ]
        return {"is_typing_test": False, "questions": fallback_qs[:q_count], "time_per_question": q_time}

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.table_slug = self.scope['url_route']['kwargs']['table_slug']
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'arena_{self.table_slug}_{self.room_id}'

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        user = self.scope.get('user')
        self.gamer_tag = user.profile.gamer_tag if user and user.is_authenticated and hasattr(user, 'profile') else "Live_Player"

        await self.channel_layer.group_send(self.room_group_name, {'type': 'game_message', 'action': 'player_joined', 'player': self.gamer_tag})

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        await self.channel_layer.group_send(self.room_group_name, {'type': 'game_message', 'action': 'player_left', 'player': self.gamer_tag})

    @database_sync_to_async
    def check_and_lock_questions(self, cache_key):
        if not cache.get(cache_key):
            cache.set(cache_key, True, 60) # 60 seconds lock
            return True
        return False

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')

        if action == 'request_questions':
            lock_key = f"lock_qs_{self.room_group_name}"
            is_first = await self.check_and_lock_questions(lock_key)
            
            if is_first:
                content = await generate_ai_content(self.table_slug)
                await self.channel_layer.group_send(
                    self.room_group_name, 
                    {'type': 'game_message', 'action': 'questions_ready', 'content': content}
                )

        elif action == 'score_update':
            await self.channel_layer.group_send(self.room_group_name, {'type': 'game_message', 'action': 'score_update', 'player': data.get('player_name', self.gamer_tag), 'score': data.get('score', 0)})

        elif action == 'game_finished':
            await self.process_game_finish(data.get('player_name', self.gamer_tag), int(data.get('score', 0)), int(data.get('wpm', 0)))

    @database_sync_to_async
    def get_cache(self, key): return cache.get(key, {})
    @database_sync_to_async
    def set_cache(self, key, value, timeout): cache.set(key, value, timeout)
    @database_sync_to_async
    def delete_cache(self, key): cache.delete(key)

    async def process_game_finish(self, player_name, final_score, wpm):
        cache_key = f"match_state_{self.room_group_name}"
        state = await self.get_cache(cache_key)
        if not state: state = {'players': {}}
        state['players'][player_name] = {'score': final_score, 'wpm': wpm}
        await self.set_cache(cache_key, state, 120)

        if len(state['players']) >= 2:
            players_list = list(state['players'].items())
            p1_name, p1_data = players_list[0]
            p2_name, p2_data = players_list[1]
            winners, losers = [], []

            if p1_data['score'] > p2_data['score']: winners.append(p1_name); losers.append(p2_name)
            elif p2_data['score'] > p1_data['score']: winners.append(p2_name); losers.append(p1_name)
            else:
                if p1_data['wpm'] > p2_data['wpm']: winners.append(p1_name); losers.append(p2_name)
                elif p2_data['wpm'] > p1_data['wpm']: winners.append(p2_name); losers.append(p1_name)

            await self.channel_layer.group_send(self.room_group_name, {'type': 'game_message', 'action': 'match_result', 'winners': winners, 'losers': losers, 'is_draw': len(winners) == 0, 'final_scores': state['players']})
            await self.delete_cache(cache_key)
        else:
            await self.send(text_data=json.dumps({'action': 'waiting_for_opponent', 'message': 'Wait...'}))

    async def game_message(self, event):
        await self.send(text_data=json.dumps(event))
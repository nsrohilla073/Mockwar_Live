import json
import random
import re
from channels.generic.websocket import AsyncWebsocketConsumer
from django.core.cache import cache
from channels.db import database_sync_to_async
from core_game.models import GameTable
from django.conf import settings
import google.generativeai as genai

# 🧠 GEMINI BRAIN (ID Based)
@database_sync_to_async
def generate_ai_content(table_id):
    table = None
    try:
        print(f"🤖 Starting AI Generation for Table ID: {table_id}")
        
        api_key = getattr(settings, 'GEMINI_API_KEY', None)
        if not api_key:
            raise Exception("GEMINI_API_KEY is missing in Render Environment Variables!")
            
        genai.configure(api_key=api_key)
        
        # 🔴 NAYA: ID se table fetch kar rahe hain
        table = GameTable.objects.filter(id=table_id).first()
        if not table:
            table = GameTable.objects.first()
            
        q_count = table.questions_count if table else 5
        q_time = table.time_per_question if table else 12
        topic_name = table.category.name if table else "General Knowledge"
        is_typing = 'typing' in topic_name.lower()
        
        available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        
        target_model = 'models/gemini-1.5-flash'
        for model_name in available_models:
            if '2.5-flash' in model_name:
                target_model = model_name
                break
            elif '1.5-flash' in model_name:
                target_model = model_name
                break
            elif 'pro' in model_name and 'vision' not in model_name:
                target_model = model_name
                
        model = genai.GenerativeModel(target_model)

        if is_typing:
            topics = ["Space Exploration", "Cybersecurity", "Ancient Indian History", "Artificial Intelligence"]
            prompt = f"Generate a unique single paragraph of exactly 40 words about '{random.choice(topics)}' for an English typing test. No markdown, no quotes."
            res = model.generate_content(prompt, generation_config=genai.types.GenerationConfig(temperature=0.9))
            para = res.text.strip().replace('\n', ' ').replace('"', '').replace('`', '')
            return {"is_typing_test": True, "paragraph": para, "time_limit": 60}
        else:
            random_seed = random.randint(100000, 999999)
            
            prompt = f"""
            Generate exactly {q_count} multiple choice questions randomly on the topic: "{topic_name}".
            
            CRITICAL INSTRUCTION FOR RANDOMNESS: 
            - Pick these {q_count} questions from a MASSIVE pool of possibilities. 
            - Mix basic, intermediate, and advanced level questions. DO NOT stick to just one sub-topic. 
            - If the topic is GK, pick from dates, places, people, events, etc. If it is Math/Science/English, pick random concepts.
            - System Random Seed: {random_seed}. You MUST generate a completely new, fresh, and shuffled set of questions every single time. DO NOT REPEAT previous questions.
            
            Question and ALL 4 options MUST be Bilingual (English / Hindi) separated by a slash (/). 
            
            Return STRICTLY a JSON array. DO NOT ADD ANY EXTRA TEXT OR MARKDOWN.
            Format:
            [ {{"id": 1, "question": "Question in Eng / प्रश्न हिंदी में?", "options": ["Option A / विकल्प A", "Option B / विकल्प B", "Option C / विकल्प C", "Option D / विकल्प D"], "answer": "A"}} ]
            """
            
            res = model.generate_content(prompt, generation_config=genai.types.GenerationConfig(temperature=1.0))
            raw = res.text.strip()
            
            start_idx = raw.find('[')
            end_idx = raw.rfind(']')
            
            if start_idx != -1 and end_idx != -1:
                clean_json_str = raw[start_idx:end_idx+1]
                parsed_json = json.loads(clean_json_str)
                random.shuffle(parsed_json)
                return {"is_typing_test": False, "questions": parsed_json, "time_per_question": q_time}
            else:
                raise Exception("No JSON array brackets found in the AI response.")
            
    except Exception as e:
        print(f"❌ AI CRITICAL ERROR: {str(e)}")
        q_count = table.questions_count if table else 5
        q_time = table.time_per_question if table else 12
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
        # 🔴 NAYA: Slug ko hata kar Table ID kar diya
        self.table_id = self.scope['url_route']['kwargs']['table_id']
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'arena_table_{self.table_id}_{self.room_id}'

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
            cache.set(cache_key, True, 60)
            return True
        return False
        
    @database_sync_to_async
    def get_table_max_players(self, t_id):
        table = GameTable.objects.filter(id=t_id).first()
        return table.max_players if table else 2

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')

        if action == 'request_questions':
            lock_key = f"lock_qs_{self.room_group_name}"
            is_first = await self.check_and_lock_questions(lock_key)
            
            if is_first:
                # 🔴 NAYA: Table ID pass ki gayi hai
                content = await generate_ai_content(self.table_id)
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

        table_max_players = await self.get_table_max_players(self.table_id)

        cache_key = f"match_state_{self.room_group_name}"
        state = await self.get_cache(cache_key)
        if not state: state = {'players': {}}
        
        # Player ka score update karo
        state['players'][player_name] = {'score': final_score, 'wpm': wpm}
        await self.set_cache(cache_key, state, 120)

        # Draw aur Winner ka logic
        if len(state['players']) >= table_max_players:
            sorted_players = sorted(state['players'].items(), key=lambda x: (x[1]['score'], x[1]['wpm']), reverse=True)

            top_score = sorted_players[0][1]['score']
            top_wpm = sorted_players[0][1]['wpm']

            winners = [name for name, data in sorted_players if data['score'] == top_score and data['wpm'] == top_wpm]
            losers = [name for name, data in sorted_players if name not in winners]

            await self.channel_layer.group_send(
                self.room_group_name, 
                {
                    'type': 'game_message', 
                    'action': 'match_result', 
                    'winners': winners, 
                    'losers': losers, 
                    'is_draw': len(winners) == table_max_players, 
                    'final_scores': state['players']
                }
            )
            await self.delete_cache(cache_key)
        else:
            await self.send(text_data=json.dumps({'action': 'waiting_for_opponent', 'message': f"Waiting for others... ({len(state['players'])}/{table_max_players})"}))

    async def game_message(self, event):
        await self.send(text_data=json.dumps(event))
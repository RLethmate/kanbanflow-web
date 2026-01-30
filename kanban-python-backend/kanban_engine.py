# kanban-python-backend/kanban_engine.py

import time
import uuid

# --- Card Class ---
class Card:
    def __init__(self, card_id, birth_id, col, x, y, is_red=False):
        self.card_id = str(card_id)
        self.birth_id = birth_id
        self.col = col
        self.x = x
        self.y = y
        self.target_col = None
        self.target_x = None
        self.moving = False
        self.days_on_board = 0
        self.start_day = 0
        self.finish_day = None
        self.cycle_time = None
        self.is_red = is_red
        self.processing_time = 0
        self.BZ = 0
        self.WZ = 0

    def to_dict(self):
        return {
            "id": self.card_id,
            "birth_id": self.birth_id,
            "col": self.col,
            "x": self.x,
            "y": self.y,
            "target_col": self.target_col,
            "target_x": self.target_x,
            "moving": self.moving,
            "days_on_board": self.days_on_board,
            "start_day": self.start_day,
            "finish_day": self.finish_day,
            "cycle_time": self.cycle_time,
            "is_red": self.is_red,
            "processing_time": self.processing_time,
            "BZ": self.BZ,
            "WZ": self.WZ
        }

# --- Helper function (from your original code, assuming it was global) ---
def get_card_color(card_id):
    return "#33A1F2" # A shade of blue, replace with your logic if needed

# --- KanbanModel Class ---
class KanbanModel:
    def __init__(self):
        # All existing attributes as before
        self.cards: list[Card] = []
        self.next_card_id = 1
        self.day_count = 0
        self.previous_run_avg = None
        self.wip_limit = 12

        self.column_names = [
            "Backlog", "Schritt A", "Warten...", "Schritt B",
            "Warten...", "Schritt C", "Warten...", "Done"
        ]
        self.column_x_positions = { # Adjusted for narrower frontend columns
            0: 50,
            1: 185,
            2: 320,
            3: 455,
            4: 590,
            5: 725,
            6: 860,
            7: 995
        }
        self.complexity_columns = [1, 3, 5]
        self.working_columns = [1, 3, 5]
        self.graph_counter = 0
        self.red_card_generated = False
        self.sim_start_time = None
        self.round_counter = 0
        self.column_max_count = [0] * len(self.column_names)

        self._is_active = False # Default state is False
        self._red_card_reached_end = False

        self._current_simulation_parameters = {
            "complexity": {str(col): 1 for col in self.working_columns},
            "wip_limit": self.wip_limit,
            "speed": 1.0
        }
        self._dashboard_metrics = []

        self._red_card_generation_day = -1
        self._red_card_delay_days = 10

        self._current_round_max_wip_per_column = {col: 0 for col in range(len(self.column_names))}

        print(f"KanbanModel: __init__ called. _is_active initially: {self._is_active}") # DEBUG
        self.reset_board_state() # This calls reset, which should explicitly set _is_active to False
        print(f"KanbanModel: __init__ finished. _is_active now: {self._is_active}") # DEBUG

    def reset_board_state(self):
        print(f"KanbanModel: reset_board_state called. _is_active before: {self._is_active}") # DEBUG
        self.cards.clear()
        self.day_count = 0
        self.previous_run_avg = None
        self.next_card_id = 1
        self.red_card_generated = False
        self.sim_start_time = None
        self.round_counter = 0
        self._red_card_reached_end = False
      #  self._dashboard_metrics.clear()
        self._is_active = False # CRITICAL: Ensure this is explicitly False
        print(f"KanbanModel: Board state reset and initial backlog created. _is_active after: {self._is_active}") # DEBUG
        self._current_round_max_wip_per_column = {col: 0 for col in range(len(self.column_names))}
        for i in range(12):
            self.add_card(col=0, is_red=False)
        print(f"KanbanModel: Board state reset and initial backlog created. _is_active after: {self._is_active}") # DEBUG

    def add_card(self, col=0, is_red=False):
        card_id = f"card-{self.next_card_id}"
        self.next_card_id += 1
        card = Card(card_id, self.next_card_id - 1, col, 0, 0, is_red=is_red)
        self.cards.append(card)
        return card

    def get_group_columns(self, col):
        if col == 1: return [1, 2]
        elif col == 3: return [3, 4]
        elif col == 5: return [5, 6]
        return []

    def is_group_full(self, group_columns):
        count = sum(1 for c in self.cards if c.col in group_columns and not c.moving)
        configured_wip_limit = self._current_simulation_parameters.get("wip_limit", self.wip_limit)
        return count >= configured_wip_limit

    def try_push_card(self, card: Card, complexity_factor: int):
        if card.processing_time < complexity_factor:
            card.processing_time += 1
            return False
        card.processing_time = 0
        return True

    def mark_card_for_move(self, card: Card, new_col: int):
        if new_col == 1 and card.is_red and card.start_day == 0:
            card.start_day = self.day_count
        card.target_col = new_col
        card.target_x = self.column_x_positions[new_col]
        card.moving = True
        print(f"KanbanModel: Card {card.birth_id} marked for move to column {new_col}")

    def set_parameters(self, complexity: dict[str, int], wip_limit: int, speed: float):
        self._current_simulation_parameters["complexity"] = {k:v for k,v in complexity.items()}
        self._current_simulation_parameters["wip_limit"] = wip_limit
        self._current_simulation_parameters["speed"] = speed
        self.wip_limit = wip_limit
        print(f"KanbanModel: Parameters updated to: {self._current_simulation_parameters}")
        return {"status": "parameters_updated"}

    def start(self):
        print(f"KanbanModel: start() called. _is_active before: {self._is_active}") # DEBUG
        if self._is_active:
            print("KanbanModel: Simulation already active (from start() check).") # DEBUG
            return {"status": "already_running", "message": "Simulation is already active."}

        self.reset_board_state() # Ensure fresh state (this calls reset_board_state, which sets _is_active = False)
        self.sim_start_time = time.time()
        self._is_active = True # Set to True to start
        self._red_card_generated = False
        self._red_card_generation_day = self.day_count + self._red_card_delay_days # Schedule red card
        self.round_counter = 0

        print(f"KanbanModel: Simulation activated. _is_active after start(): {self._is_active}. Red card scheduled for day {self._red_card_generation_day}.") # DEBUG
        return {"status": "success", "message": "Simulation activated."}

    def stop(self):
        print(f"KanbanModel: stop() called. _is_active before: {self._is_active}") # DEBUG
        if not self._is_active:
            print("KanbanModel: Simulation not active (from stop() check).") # DEBUG
            return {"status": "not_running", "message": "Simulation is not active."}
        self._is_active = False # Set to False to stop
        print(f"KanbanModel: Simulation stopped. _is_active after stop(): {self._is_active}") # DEBUG
        return {"status": "success", "message": "Simulation stopped."}

    def is_active(self):
        result = self._is_active
        # print(f"KanbanModel: is_active() called. Returning: {result}") # COMMENT THIS OUT - too chatty
        return result
    def has_red_card_reached_end(self):
        return self._red_card_reached_end

    def get_current_board_state(self):
        lanes_for_api = []
        for col_idx, col_name in enumerate(self.column_names):
            lane_cards = [card.to_dict() for card in self.cards if card.col == col_idx]
            current_lane_wip = len(lane_cards)

            self._current_round_max_wip_per_column[col_idx] = max(
                self._current_round_max_wip_per_column.get(col_idx, 0),
                current_lane_wip
            )

            lanes_for_api.append({
                "id": f"lane-{col_idx}",
                "title": col_name,
                "cards": lane_cards,
                "wip_limit": self._current_simulation_parameters.get("wip_limit", self.wip_limit),
                "max_wip_in_round": self._current_round_max_wip_per_column.get(col_idx, 0)
            })
        return {"lanes": lanes_for_api}

    def get_dashboard_metrics(self):
        return self._dashboard_metrics

    def clear_dashboard_data(self):
        self._dashboard_metrics.clear()
        self.round_counter = 0
        print("KanbanModel: Dashboard data cleared and round counter reset.")

    def _generate_red_card_internal(self):
        if not self.red_card_generated:
            backlog_cards = [c for c in self.cards if c.col == 0 and not c.moving]
            if backlog_cards:
                backlog_cards.sort(key=lambda x: x.birth_id)
                red_card = backlog_cards[0]
                red_card.is_red = True
                red_card.processing_time = 0
                self.red_card_generated = True
                print(f"KanbanModel: Red card (ID: {red_card.card_id}) generated at day {self.day_count}.")
            else:
                print("KanbanModel: No backlog cards to turn red to meet generation condition.")

    def _try_push_card_internal(self, col):
        own_cards = [c for c in self.cards if c.col == col and not c.moving]
        if not own_cards:
            return False
        own_cards.sort(key=lambda x: x.birth_id)
        card = own_cards[0]

        complexity_factor = self._current_simulation_parameters.get("complexity", {}).get(str(col), 1)

        if card.processing_time < complexity_factor:
            card.processing_time += 1
            return False
        card.processing_time = 0
        self._mark_card_for_move_internal(card, col + 1)
        return True

    def _mark_card_for_move_internal(self, card, new_col):
        if new_col == 1 and card.is_red and card.start_day == 0:
            card.start_day = self.day_count
        card.target_col = new_col
        card.target_x = self.column_x_positions[new_col]
        card.moving = True
        print(f"KanbanModel: Card {card.birth_id} marked for move to column {new_col}")

    def _update_card_positions_and_state(self):
        for card in self.cards:
            if card.moving and card.target_col is not None:
                old_col = card.col
                card.col = card.target_col
                card.x = card.target_x
                card.moving = False
                card.target_x = None
                card.target_col = None
                print(f"KanbanModel: Card {card.birth_id} logically moved from {old_col} to {card.col}")

                if card.col == 7:
                    card.finish_day = self.day_count
                    card.cycle_time = card.finish_day - card.start_day
                    print(f"KanbanModel: Card {card.birth_id} finished. Cycle time: {card.cycle_time}")

    def advance_one_simulation_step(self):
        if not self._is_active:
            print("KanbanModel: advance_one_simulation_step called but simulation is not active. Exiting.") # DEBUG
            return

        self.day_count += 1
        print(f"KanbanModel: Advancing simulation to Day {self.day_count}")

        if not self.red_card_generated and self.day_count >= self._red_card_generation_day:
            self._generate_red_card_internal()
        # 2. Update Flow Efficiency for Red Card (if exists)
        red_card = next((c for c in self.cards if c.is_red), None)
        if red_card:
            if red_card.col in self.working_columns:
                red_card.BZ += 1
            elif red_card.col in [2, 4, 6]:
                mapping_wait_to_active = {2: 1, 4: 3, 6: 5}
                preceding_active_col = mapping_wait_to_active.get(red_card.col)
                if preceding_active_col is not None:
                    active_cards_in_preceding = any(c for c in self.cards if c.col == preceding_active_col and not c.moving)
                    if active_cards_in_preceding:
                        red_card.WZ += 1
                else:
                    # If a waiting column without a direct preceding active_col in the map,
                    # your original logic also incremented WZ. Keep this if it's general wait time.
                    red_card.WZ += 1
            print(f"KanbanModel: Red card BZ: {red_card.BZ}, WZ: {red_card.WZ}")

        for col in self.working_columns:
            if self._try_push_card_internal(col):
                pass
            else:
                group = self.get_group_columns(col)
                if not self.is_group_full(group):
                    prev_col = col - 1
                    if prev_col >= 0:
                        prev_cards = [c for c in self.cards if c.col == prev_col and not c.moving]
                        prev_cards.sort(key=lambda x: x.birth_id)
                        if prev_cards:
                            self._mark_card_for_move_internal(prev_cards[0], col)

        final_push_cards = [c for c in self.cards if c.col == 6 and not c.moving]
        if final_push_cards:
            final_push_cards.sort(key=lambda x: x.birth_id)
            self._mark_card_for_move_internal(final_push_cards[0], 7)

        self._update_card_positions_and_state()

        was_red_card_reached_end_before = self._red_card_reached_end
        self._red_card_reached_end = any(c for c in self.cards if c.is_red and c.col == 7)
 
        # DEBUG: Log the status of the red card stop flag
        print(f"KanbanModel: Day {self.day_count}. _red_card_reached_end: {self._red_card_reached_end} (was: {was_red_card_reached_end_before}).")

        if self._red_card_reached_end and not was_red_card_reached_end_before: # If it just reached the end THIS round
            print(f"KanbanModel: Day {self.day_count}. Red card JUST reached last column. Calling self.stop().") # DEBUG
            self.stop() # This sets _is_active = False, stopping the loop
            self._calculate_and_add_dashboard_entry() # Add final dashboard entry
            return # Crucial: this return exits the advance_one_simulation_step call.



        backlog_cards = [c for c in self.cards if c.col == 0]
        while len(backlog_cards) < 12:
            self.add_card(col=0)
            backlog_cards = [c for c in self.cards if c.col == 0]

    def _calculate_and_add_dashboard_entry(self):
        self.round_counter += 1
        print("KanbanModel: Calculating dashboard entry for round:", self.round_counter)

        in_progress_count = sum(1 for c in self.cards if c.col not in (0, 7))
        done_count = sum(1 for c in self.cards if c.col == 7)

        red_card_cycle_time = next((c.cycle_time for c in self.cards if c.is_red and c.cycle_time is not None), 0)

        throughput = done_count / red_card_cycle_time if red_card_cycle_time != 0 else 0

        flow_efficiency = 0
        red_card = next((c for c in self.cards if c.is_red), None)
        if red_card:
            total_time = red_card.BZ + red_card.WZ
            if total_time > 0:
                flow_efficiency = (red_card.BZ / total_time) * 100

        dashboard_entry = {
            "round": self.round_counter,
            "wip_limit": self._current_simulation_parameters.get("wip_limit", self.wip_limit),
            "red_card_cycle_time": f"{red_card_cycle_time:.2f}",
            "flow_efficiency": f"{flow_efficiency:.2f}%",
            "in_progress": in_progress_count,
            "done": done_count,
            "throughput": f"{throughput:.2f}"
        }
        self._dashboard_metrics.append(dashboard_entry)
        print(f"KanbanModel: Dashboard entry added: {dashboard_entry}")
    # >>> CRITICAL: ENSURE THIS METHOD IS PRESENT INSIDE THE KanbanModel CLASS <<<
    def get_simulation_speed(self):
        """Returns the current configured simulation speed from model's parameters."""
        return self._current_simulation_parameters.get("speed", 1.0)
    # >>> END CRITICAL SECTION <<<


# --- Global instance of your Kanban Engine ---
_kanban_model = KanbanModel()

# --- Functions to be called by FastAPI (main.py) ---
def initialize_engine_api():
    _kanban_model.reset_board_state()
    print("kanban_engine.py: Module initialized and board reset.")

def set_simulation_parameters_api(complexity: dict[str, int], wip_limit: int, speed: float):
    _kanban_model.set_parameters(complexity, wip_limit, speed)

def start_simulation_api():
    _kanban_model.start()

def stop_simulation_api():
    _kanban_model.stop()
 
def is_simulation_active_api():
    return _kanban_model.is_active()

def has_red_card_reached_end_api():
    return _kanban_model.has_red_card_reached_end()

def get_current_board_state_api():
    return _kanban_model.get_current_board_state()

def get_dashboard_metrics_api():
    return _kanban_model.get_dashboard_metrics()

def clear_dashboard_data_api():
    _kanban_model.clear_dashboard_data()

def advance_simulation_step_api():
    _kanban_model.advance_one_simulation_step()

def get_simulation_speed_api():
    return _kanban_model.get_simulation_speed()
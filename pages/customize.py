import streamlit as st
from db import get_processor_config, save_processor_config
import json

st.title("Customize Processor Logic")

# Default logic for restrictions (hardcoded to match db defaults)
DEFAULT_LOGIC = {
    'Undervalued': {'enabled': True, 'boost': 15},
    'Strong Balance Sheet': {'enabled': True, 'boost': 10},
    'Quality Moat': {'enabled': True, 'boost': 15},
    'GARP': {'enabled': True, 'boost': 10},
    'High-Risk Growth': {'enabled': True, 'boost': -10},
    'Value Trap': {'enabled': True, 'boost': -10},
    'Momentum Building': {'enabled': True, 'boost': 5},
    'Debt Burden': {'enabled': True, 'boost': -15}
}

# Load config
config_name = st.text_input("Config Name (e.g., 'default' to edit existing)", value="default")
if st.button("Load Config"):
    config = get_processor_config(config_name)
    if config:
        st.session_state.weights = config['weights']
        st.session_state.metrics = config['metrics']
        st.session_state.logic = config['logic']
        st.success(f"Loaded config '{config_name}'")
    else:
        st.error("Config not found. Starting with defaults.")
        st.session_state.weights = {
            'P/E': 0.2, 'ROE': 0.15, 'D/E': 0.1, 'P/B': 0.1, 'PEG': 0.1,
            'Gross Margin': 0.1, 'Net Profit Margin': 0.1, 'FCF % EV TTM': 0.075,
            'EBITDA % EV TTM': 0.075, 'Balance': 0.05
        }
        st.session_state.metrics = list(st.session_state.weights.keys())
        st.session_state.logic = DEFAULT_LOGIC.copy()

# Metrics Selector
st.subheader("Select Metrics to Include")
available_metrics = ['P/E', 'ROE', 'D/E', 'P/B', 'PEG', 'Gross Margin', 'Net Profit Margin', 'FCF % EV TTM', 'EBITDA % EV TTM', 'Balance']
selected_metrics = st.multiselect("Metrics", available_metrics, default=st.session_state.get('metrics', available_metrics))
st.session_state.metrics = selected_metrics

# Weights Editor (only for selected, restrict 0-0.3)
st.subheader("Edit Weights (0.0 - 0.3; should sum to ~1 for selected)")
weights = st.session_state.get('weights', {})
for metric in selected_metrics:
    if metric not in weights:
        weights[metric] = 0.1  # Default if new
    weights[metric] = st.slider(f"{metric} Weight", 0.0, 0.3, weights[metric], 0.01)
total_weight = sum(weights.get(m, 0) for m in selected_metrics)
if total_weight > 1.0 or total_weight < 0.9:
    st.warning(f"Weights sum to {total_weight:.2f}; ideally ~1.0 for accurate scoring.")

# Logic Editor
st.subheader("Customize Logic Flags")
logic = st.session_state.get('logic', DEFAULT_LOGIC.copy())
for flag, data in DEFAULT_LOGIC.items():
    default_boost = data['boost']
    min_boost = default_boost - 10
    max_boost = default_boost + 10
    col1, col2 = st.columns(2)
    with col1:
        enabled = st.checkbox(f"Enable {flag}", value=logic.get(flag, {}).get('enabled', True))
    with col2:
        boost = st.slider(f"{flag} Boost", min_boost, max_boost, logic.get(flag, {}).get('boost', default_boost), 1)
    logic[flag] = {'enabled': enabled, 'boost': boost}
st.session_state.logic = logic

# Save
if st.button("Save Config"):
    save_processor_config(config_name, weights, selected_metrics, logic)
    st.success(f"Saved config '{config_name}'")

# JSON Export/Import
st.subheader("Export/Import Config")
config_data = {'weights': weights, 'metrics': selected_metrics, 'logic': logic}
st.download_button("Export JSON", data=json.dumps(config_data), file_name=f"{config_name}.json", mime="application/json")

uploaded_file = st.file_uploader("Import JSON")
if uploaded_file:
    imported = json.load(uploaded_file)
    st.session_state.weights = imported['weights']
    st.session_state.metrics = imported['metrics']
    st.session_state.logic = imported['logic']
    st.success("Imported config. Edit and save with a name.")
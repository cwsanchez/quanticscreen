import streamlit as st
from db import get_processor_config, save_processor_config
import json

st.title("Customize Processor Logic")

# Load default or existing config
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
        st.session_state.logic = {}  # Placeholder for custom logic

# Weights Editor
st.subheader("Edit Weights (must sum to 1)")
weights = st.session_state.get('weights', {})
for metric in weights:
    weights[metric] = st.slider(f"{metric} Weight", 0.0, 1.0, weights[metric], 0.01)
if sum(weights.values()) != 1.0:
    st.warning("Weights should sum to 1.0 for accurate scoring.")

# Metrics Selector (only existing for now)
st.subheader("Select Metrics")
available_metrics = ['P/E', 'ROE', 'D/E', 'P/B', 'PEG', 'Gross Margin', 'Net Profit Margin', 'FCF % EV TTM', 'EBITDA % EV TTM', 'Balance']  # Hard-coded existing
selected_metrics = st.multiselect("Metrics to Include", available_metrics, default=st.session_state.get('metrics', available_metrics))

# Logic Editor (advanced, as JSON for thresholds/flags)
st.subheader("Custom Logic (JSON)")
logic_json = st.text_area("Edit Logic JSON", value=json.dumps(st.session_state.get('logic', {}), indent=2))

if st.button("Save Config"):
    try:
        logic = json.loads(logic_json)
        save_processor_config(config_name, weights, selected_metrics, logic)
        st.success(f"Saved config '{config_name}'")
    except json.JSONDecodeError:
        st.error("Invalid JSON in logic.")

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
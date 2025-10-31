import streamlit as st
import json
from processor import DEFAULT_LOGIC

st.title("Customize Processor Logic")

# Default weights and metrics
default_weights = {
    'P/E': 0.2, 'ROE': 0.15, 'D/E': 0.1, 'P/B': 0.1, 'PEG': 0.1,
    'Gross Margin': 0.1, 'Net Profit Margin': 0.1, 'FCF % EV TTM': 0.075,
    'EBITDA % EV TTM': 0.075, 'Balance': 0.05
}
default_metrics = list(default_weights.keys())

# Presets definitions
presets = {
    'Value': {
        'weights': default_weights.copy(),
        'metrics': default_metrics.copy(),
        'logic': DEFAULT_LOGIC.copy()
    },
    'Growth': {
        'weights': {'Revenue Growth': 0.15, 'Earnings Growth': 0.15, 'PEG': 0.15, 'Forward P/E': 0.1, 'D/E': 0.1, 'ROE': 0.1, 'Gross Margin': 0.1, 'Net Profit Margin': 0.1, 'Growth': 0.3},
        'metrics': ['Revenue Growth', 'Earnings Growth', 'PEG', 'Forward P/E', 'D/E', 'ROE', 'Gross Margin', 'Net Profit Margin'],
        'logic': {k: v.copy() for k, v in DEFAULT_LOGIC.items()}  # Add boosts, e.g., GARP boost +20
    },
    'Momentum': {
        'weights': {'52W High': 0.1, 'RSI': 0.1, 'Average Volume': 0.1, 'ROE': 0.1, 'P/E': 0.1, 'Momentum': 0.3},
        'metrics': ['52W High', 'RSI', 'Average Volume', 'ROE', 'P/E'],
        'logic': {k: v.copy() for k, v in DEFAULT_LOGIC.items()}  # Adjust for momentum flags
    },
    'Quality': {
        'weights': {'ROE': 0.15, 'D/E': 0.1, 'Gross Margin': 0.1, 'Dividend Yield': 0.1, 'Beta': 0.1, 'Quality': 0.3},
        'metrics': ['ROE', 'D/E', 'Gross Margin', 'Dividend Yield', 'Beta'],
        'logic': {k: v.copy() for k, v in DEFAULT_LOGIC.items()}  # Boost for quality moat
    }
}
# Adjust boosts for presets
presets['Growth']['logic']['GARP']['boost'] = 20
# Similarly for others...

# Initialize configs if not present
if 'configs' not in st.session_state:
    st.session_state.configs = {k: v.copy() for k, v in presets.items()}  # Load presets
    # Rename default to Value if needed, but since Value is preset, it's covered

# Preset selector
preset = st.selectbox("Load Preset", list(presets.keys()))
if st.button("Load Preset"):
    if preset in presets:
        config = presets[preset]
        st.session_state.weights = config['weights'].copy()
        st.session_state.selected_metrics = config['metrics'].copy()
        st.session_state.logic = config['logic'].copy()
        st.success(f"Loaded preset '{preset}'")
    else:
        st.warning("Preset not found.")

# Load custom config
config_name = st.text_input("Config Name for Custom (e.g., 'my_config')", value="NewConfig1")
if st.button("Load Custom Config"):
    if config_name in st.session_state.configs:
        config = st.session_state.configs[config_name]
        st.session_state.weights = config['weights']
        st.session_state.selected_metrics = config['metrics']
        st.session_state.logic = config['logic']
        st.success(f"Loaded config '{config_name}'")
    else:
        st.warning("Config not found. Starting with defaults.")
        st.session_state.weights = default_weights.copy()
        st.session_state.selected_metrics = default_metrics.copy()
        st.session_state.logic = DEFAULT_LOGIC.copy()

# Ensure session state is initialized
if 'weights' not in st.session_state:
    st.session_state.weights = default_weights.copy()
    st.session_state.selected_metrics = default_metrics.copy()
    st.session_state.logic = DEFAULT_LOGIC.copy()

# Auto-increment for new configs
def get_unique_name(base_name):
    name = base_name
    i = 1
    while name in st.session_state.configs:
        name = f"{base_name}{i}"
        i += 1
    return name

if config_name.startswith("NewConfig"):
    config_name = get_unique_name("NewConfig")

# Metrics Selector
st.subheader("Select Metrics to Include")
available_metrics = ['P/E', 'ROE', 'D/E', 'P/B', 'PEG', 'Gross Margin', 'Net Profit Margin', 'FCF % EV TTM', 'EBITDA % EV TTM', 'Balance']
st.session_state.selected_metrics = st.multiselect("Metrics", available_metrics, default=st.session_state.selected_metrics)

# Weights Editor (only for selected, restrict 0-0.3)
st.subheader("Edit Weights (0.0 - 0.3; should sum to ~1 for selected)")
for metric in st.session_state.selected_metrics:
    if metric not in st.session_state.weights:
        st.session_state.weights[metric] = 0.1  # Default if new
    st.session_state.weights[metric] = st.slider(f"{metric} Weight", 0.0, 0.3, st.session_state.weights[metric], 0.01)
total_weight = sum(st.session_state.weights.get(m, 0) for m in st.session_state.selected_metrics)
if total_weight > 1.0 or total_weight < 0.9:
    st.warning(f"Weights sum to {total_weight:.2f}; ideally ~1.0 for accurate scoring.")

# Logic Editor
st.subheader("Customize Logic Flags")
for flag, data in DEFAULT_LOGIC.items():
    default_boost = data['boost']
    min_boost = default_boost - 10
    max_boost = default_boost + 10
    col1, col2 = st.columns(2)
    with col1:
        enabled = st.checkbox(f"Enable {flag}", value=st.session_state.logic.get(flag, {}).get('enabled', True))
    with col2:
        boost = st.slider(f"{flag} Boost", min_boost, max_boost, st.session_state.logic.get(flag, {}).get('boost', default_boost), 1)
    st.session_state.logic[flag] = {'enabled': enabled, 'boost': boost}

# Save
if st.button("Save Config"):
    if config_name in presets:
        st.warning("Cannot overwrite preset. Please rename to save.")
        new_name = st.text_input("New Name", value=get_unique_name(config_name + "_copy"))
        if st.button("Save As New"):
            st.session_state.configs[new_name] = {
                'weights': st.session_state.weights.copy(),
                'metrics': st.session_state.selected_metrics.copy(),
                'logic': st.session_state.logic.copy()
            }
            st.success(f"Saved as '{new_name}'")
    else:
        st.session_state.configs[config_name] = {
            'weights': st.session_state.weights.copy(),
            'metrics': st.session_state.selected_metrics.copy(),
            'logic': st.session_state.logic.copy()
        }
        st.success(f"Saved config '{config_name}'")

# JSON Export/Import
st.subheader("Export/Import Config")
config_data = {
    'weights': st.session_state.weights,
    'metrics': st.session_state.selected_metrics,
    'logic': st.session_state.logic
}
st.download_button("Export JSON", data=json.dumps(config_data), file_name=f"{config_name}.json", mime="application/json")

uploaded_file = st.file_uploader("Import JSON")
if uploaded_file:
    imported = json.load(uploaded_file)
    import_name = st.text_input("Name for Imported Config", value="imported")
    if st.button("Save Imported Config"):
        st.session_state.configs[import_name] = imported
        st.success(f"Imported and saved as '{import_name}'. Edit and save if needed.")
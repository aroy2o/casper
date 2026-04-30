import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
let recognitionInstance = null;
const initialState = {
    isListening: false,
    transcript: "",
    answer: "",
    status: "idle",
    error: null
};
export const sendVoiceQuery = createAsyncThunk("voice/sendVoiceQuery", async (transcript, { rejectWithValue }) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/voice/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript })
    });
    const json = (await response.json());
    if (!response.ok || !json.success || !json.data) {
        return rejectWithValue(json.error?.message ?? "Voice query failed");
    }
    return json.data;
});
const voiceSlice = createSlice({
    name: "voice",
    initialState,
    reducers: {
        startListening: (state) => {
            state.isListening = true;
            state.error = null;
            const SpeechRecognitionImpl = window
                .SpeechRecognition ||
                window
                    .webkitSpeechRecognition;
            if (!SpeechRecognitionImpl) {
                state.error = "Speech recognition is not supported in this browser";
                state.isListening = false;
                return;
            }
            const recognition = new SpeechRecognitionImpl();
            recognition.lang = "en-IN";
            recognition.interimResults = false;
            recognition.continuous = false;
            recognition.onresult = (event) => {
                const speechEvent = event;
                const transcript = speechEvent.results?.[0]?.[0]?.transcript ?? "";
                window.dispatchEvent(new CustomEvent("casper-voice-transcript", { detail: transcript }));
            };
            recognition.onerror = () => {
                window.dispatchEvent(new CustomEvent("casper-voice-error", { detail: "Voice capture failed" }));
            };
            recognition.onend = () => {
                window.dispatchEvent(new CustomEvent("casper-voice-end"));
            };
            recognition.start();
            recognitionInstance = recognition;
        },
        stopListening: (state) => {
            state.isListening = false;
            recognitionInstance?.stop();
            recognitionInstance = null;
        },
        setTranscript: (state, action) => {
            state.transcript = action.payload;
        },
        speakAnswer: (state, action) => {
            const utter = new SpeechSynthesisUtterance(action.payload);
            utter.lang = "en-IN";
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utter);
            state.answer = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(sendVoiceQuery.pending, (state) => {
            state.status = "loading";
            state.error = null;
        })
            .addCase(sendVoiceQuery.fulfilled, (state, action) => {
            state.status = "idle";
            state.answer = action.payload.answer;
            state.transcript = action.payload.transcript;
        })
            .addCase(sendVoiceQuery.rejected, (state, action) => {
            state.status = "failed";
            state.error = String(action.payload ?? "Voice query failed");
        });
    }
});
export const { startListening, stopListening, setTranscript, speakAnswer } = voiceSlice.actions;
export default voiceSlice.reducer;

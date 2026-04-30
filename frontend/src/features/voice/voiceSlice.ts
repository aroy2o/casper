import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

interface VoiceState {
  isListening: boolean;
  transcript: string;
  answer: string;
  status: "idle" | "loading" | "failed";
  error: string | null;
}

interface VoiceResponse {
  transcript: string;
  answer: string;
}

type SpeechRecognitionConstructor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

let recognitionInstance: {
  stop: () => void;
} | null = null;

const initialState: VoiceState = {
  isListening: false,
  transcript: "",
  answer: "",
  status: "idle",
  error: null
};

export const sendVoiceQuery = createAsyncThunk(
  "voice/sendVoiceQuery",
  async (transcript: string, { rejectWithValue }) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/voice/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript })
    });

    const json = (await response.json()) as {
      success: boolean;
      data?: VoiceResponse;
      error?: { message: string };
    };

    if (!response.ok || !json.success || !json.data) {
      return rejectWithValue(json.error?.message ?? "Voice query failed");
    }

    return json.data;
  }
);

const voiceSlice = createSlice({
  name: "voice",
  initialState,
  reducers: {
    startListening: (state) => {
      state.isListening = true;
      state.error = null;

      const SpeechRecognitionImpl =
        (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor })
          .SpeechRecognition ||
        (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor })
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
        const speechEvent = event as Event & {
          results?: ArrayLike<ArrayLike<{ transcript: string }>>;
        };
        const transcript = speechEvent.results?.[0]?.[0]?.transcript ?? "";
        window.dispatchEvent(new CustomEvent<string>("casper-voice-transcript", { detail: transcript }));
      };
      recognition.onerror = () => {
        window.dispatchEvent(new CustomEvent<string>("casper-voice-error", { detail: "Voice capture failed" }));
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
    setTranscript: (state, action: PayloadAction<string>) => {
      state.transcript = action.payload;
    },
    speakAnswer: (state, action: PayloadAction<string>) => {
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

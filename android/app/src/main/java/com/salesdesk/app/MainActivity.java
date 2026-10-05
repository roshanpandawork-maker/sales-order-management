package com.salesdesk.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.net.Uri;

import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity implements TextToSpeech.OnInitListener {
    private static final int REQ_AUDIO = 7001;

    private WebView webView;
    private SpeechRecognizer recognizer;
    private TextToSpeech tts;
    private boolean voicePending = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(15,23,42));
        getWindow().setNavigationBarColor(Color.rgb(15,23,42));

        webView = new WebView(this);
        setContentView(webView);

        configureWebView();
        tts = new TextToSpeech(this, this);
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    private void configureWebView() {
        webView.setBackgroundColor(Color.rgb(15,23,42));
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        webView.getSettings().setAllowContentAccess(true);
        webView.getSettings().setBuiltInZoomControls(false);
        webView.getSettings().setDisplayZoomControls(false);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);

        webView.addJavascriptInterface(new AndroidVoiceBridge(), "AndroidVoice");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, 7100);
                } catch (Exception e) {
                    callback.onReceiveValue(null);
                }
                fileCallback = callback;
                return true;
            }
        });
    }

    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == 7100 && fileCallback != null) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getData() != null) results = new Uri[]{data.getData()};
                else if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    results = new Uri[n];
                    for (int i = 0; i < n; i++) results[i] = data.getClipData().getItemAt(i).getUri();
                }
            }
            fileCallback.onReceiveValue(results);
            fileCallback = null;
        }
    }

    private void startNativeVoice() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            sendVoiceError("Speech recognition is not available on this phone.");
            return;
        }

        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }

        try {
            if (android.os.Build.VERSION.SDK_INT >= 31 &&
                    SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) {
                recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(this);
            } else {
                recognizer = SpeechRecognizer.createSpeechRecognizer(this);
            }
        } catch (Exception e) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        }

        recognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle params) {
                sendVoiceStatus("Listening…");
            }
            @Override public void onBeginningOfSpeech() { sendVoiceStatus("Listening…"); }
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() { sendVoiceStatus("Processing…"); }
            @Override public void onPartialResults(Bundle partialResults) {}
            @Override public void onEvent(int eventType, Bundle params) {}

            @Override public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                String text = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                if (text.isEmpty()) sendVoiceError("I could not hear a command. Please try again.");
                else sendVoiceResult(text);
                destroyRecognizer();
            }

            @Override public void onError(int error) {
                sendVoiceError(errorMessage(error));
                destroyRecognizer();
            }
        });

        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN");
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "en-IN");
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);

        recognizer.startListening(intent);
    }

    private String errorMessage(int code) {
        switch (code) {
            case SpeechRecognizer.ERROR_AUDIO: return "Microphone audio error.";
            case SpeechRecognizer.ERROR_CLIENT: return "Voice recognition client error.";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "Microphone permission is required.";
            case SpeechRecognizer.ERROR_NETWORK: return "Voice recognition needs a network connection.";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "Voice recognition network timed out.";
            case SpeechRecognizer.ERROR_NO_MATCH: return "I could not understand that. Please try again.";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "Voice recognition is busy. Try again.";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "No speech detected.";
            case SpeechRecognizer.ERROR_SERVER_DISCONNECTED: return "Speech service disconnected. Try again.";
            default: return "Voice recognition failed. Please try again.";
        }
    }

    private void destroyRecognizer() {
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
    }

    private void sendVoiceResult(String text) {
        String safe = jsQuote(text);
        runOnUiThread(() -> webView.evaluateJavascript(
                "window.salesDeskNativeVoiceResult && window.salesDeskNativeVoiceResult(" + safe + ")", null));
    }

    private void sendVoiceError(String text) {
        String safe = jsQuote(text);
        runOnUiThread(() -> webView.evaluateJavascript(
                "window.salesDeskNativeVoiceError && window.salesDeskNativeVoiceError(" + safe + ")", null));
    }

    private void sendVoiceStatus(String text) {
        String safe = jsQuote(text);
        runOnUiThread(() -> webView.evaluateJavascript(
                "document.getElementById('voiceStatus') && (document.getElementById('voiceStatus').textContent=" + safe + ")", null));
    }

    private String jsQuote(String value) {
        return "'" + value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r") + "'";
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == REQ_AUDIO) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED && voicePending) {
                voicePending = false;
                startNativeVoice();
            } else {
                voicePending = false;
                sendVoiceError("Microphone permission was denied.");
            }
        }
    }

    @Override
    public void onInit(int status) {
        if (tts != null && status == TextToSpeech.SUCCESS) {
            tts.setLanguage(Locale.forLanguageTag("en-IN"));
            tts.setSpeechRate(0.95f);
        }
    }

    @Override
    protected void onDestroy() {
        destroyRecognizer();
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    private class AndroidVoiceBridge {
        @JavascriptInterface
        public void startListening() {
            runOnUiThread(() -> {
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    voicePending = true;
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_AUDIO);
                    return;
                }
                startNativeVoice();
            });
        }

        @JavascriptInterface
        public void stopListening() {
            runOnUiThread(() -> {
                if (recognizer != null) recognizer.stopListening();
            });
        }

        @JavascriptInterface
        public void speak(String text) {
            runOnUiThread(() -> {
                if (tts != null && !text.isEmpty()) {
                    tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "salesdesk");
                }
            });
        }
    }
}

using System.Text.Json;
using DiscordVoiceMonitor.Wpf.Models;
using Fleck;

namespace DiscordVoiceMonitor.Wpf.Services;

public sealed class VoiceMonitorServer : IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private WebSocketServer? _server;
    private IWebSocketConnection? _activeConnection;

    public event EventHandler<VoiceSnapshot>? SnapshotReceived;
    public event EventHandler<bool>? ConnectionStateChanged;

    public void Start()
    {
        if (_server is not null) return;

        FleckLog.Level = LogLevel.Warn;
        _server = new WebSocketServer("ws://127.0.0.1:3939");
        _server.Start(socket =>
        {
            socket.OnOpen = () =>
            {
                _activeConnection = socket;
                ConnectionStateChanged?.Invoke(this, true);

                try
                {
                    socket.Send("{\"type\":\"hello\"}");
                }
                catch
                {
                    // Ignore hello failures.
                }
            };

            socket.OnMessage = message =>
            {
                try
                {
                    var snapshot = JsonSerializer.Deserialize<VoiceSnapshot>(message, JsonOptions);
                    if (snapshot is null) return;

                    snapshot.Connected = true;
                    SnapshotReceived?.Invoke(this, snapshot);
                }
                catch
                {
                    // Ignore malformed payloads.
                }
            };

            socket.OnClose = () =>
            {
                if (!ReferenceEquals(_activeConnection, socket)) return;
                _activeConnection = null;
                ConnectionStateChanged?.Invoke(this, false);
            };

            socket.OnError = _ =>
            {
                if (!ReferenceEquals(_activeConnection, socket)) return;
                _activeConnection = null;
                ConnectionStateChanged?.Invoke(this, false);
            };
        });
    }

    public void Dispose()
    {
        try
        {
            _activeConnection?.Close();
        }
        catch
        {
            // Nothing to do.
        }

        _activeConnection = null;
        _server = null;
    }
}

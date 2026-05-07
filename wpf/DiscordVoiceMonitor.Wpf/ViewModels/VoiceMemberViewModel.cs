using System.Windows;

namespace DiscordVoiceMonitor.Wpf.ViewModels;

public sealed class VoiceMemberViewModel : ObservableObject
{
    private string? _avatarUrl;
    private bool _isSpeaking;
    private Thickness _itemMargin;
    private int _zIndex;

    public string Id { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public string Username { get; init; } = string.Empty;
    public bool IsMuted { get; init; }
    public bool IsDeafened { get; init; }
    public bool IsSelf { get; init; }

    public string? AvatarUrl
    {
        get => _avatarUrl;
        set => SetProperty(ref _avatarUrl, value);
    }

    public bool IsSpeaking
    {
        get => _isSpeaking;
        set => SetProperty(ref _isSpeaking, value);
    }

    public Thickness ItemMargin
    {
        get => _itemMargin;
        set => SetProperty(ref _itemMargin, value);
    }

    public int ZIndex
    {
        get => _zIndex;
        set => SetProperty(ref _zIndex, value);
    }

    public string DetailLine
    {
        get
        {
            var parts = new List<string>();
            if (!string.IsNullOrWhiteSpace(Username) && Username != DisplayName)
            {
                parts.Add($"@{Username}");
            }

            if (IsMuted)
            {
                parts.Add("mute");
            }

            if (IsDeafened)
            {
                parts.Add("deaf");
            }

            return string.Join(" / ", parts);
        }
    }

    public bool HasDetailLine => !string.IsNullOrWhiteSpace(DetailLine);

    public string StatusText => IsSpeaking ? "Speaking" : "Idle";
}

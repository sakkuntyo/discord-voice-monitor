using System.Collections.ObjectModel;
using System.Globalization;
using System.Windows;
using System.Windows.Media;
using DiscordVoiceMonitor.Wpf.Models;

namespace DiscordVoiceMonitor.Wpf.ViewModels;

public sealed class MainWindowViewModel : ObservableObject
{
    private static readonly IReadOnlyDictionary<string, string> FontMap = new Dictionary<string, string>
    {
        ["ui"] = "Segoe UI",
        ["gothic"] = "Yu Gothic UI",
        ["rounded"] = "Arial Rounded MT Bold",
        ["serif"] = "Yu Mincho",
        ["mono"] = "Cascadia Mono"
    };

    private readonly Dictionary<string, int> _memberOrder = [];
    private int _nextMemberOrder;
    private MonitorLayout _selectedLayout;
    private string _backgroundColorHex;
    private double _itemGap;
    private bool _nameVisible;
    private bool _dadAvatarVisible;
    private bool _settingsVisible;
    private bool _summaryVisible;
    private string _selectedFontKey;
    private string _channelLabel = "VC 未接続";
    private int _memberCount;
    private int _speakingCount;
    private string _updatedAtLabel = "未受信";
    private bool _isConnected;
    private double _windowWidth;
    private double _windowHeight;

    public MainWindowViewModel(AppSettings settings)
    {
        LayoutOptions = Enum.GetValues<MonitorLayout>();
        FontOptions =
        [
            new NameFontOption { Key = "ui", Label = "UI Sans", FontFamilyName = FontMap["ui"] },
            new NameFontOption { Key = "gothic", Label = "Japanese Gothic", FontFamilyName = FontMap["gothic"] },
            new NameFontOption { Key = "rounded", Label = "Rounded", FontFamilyName = FontMap["rounded"] },
            new NameFontOption { Key = "serif", Label = "Serif", FontFamilyName = FontMap["serif"] },
            new NameFontOption { Key = "mono", Label = "Monospace", FontFamilyName = FontMap["mono"] }
        ];

        _selectedLayout = settings.Layout;
        _backgroundColorHex = NormalizeColor(settings.BackgroundColorHex);
        _itemGap = ClampGap(settings.ItemGap);
        _nameVisible = settings.NameVisible;
        _dadAvatarVisible = settings.DadAvatarVisible;
        _settingsVisible = settings.SettingsVisible;
        _summaryVisible = settings.SummaryVisible;
        _selectedFontKey = FontMap.ContainsKey(settings.NameFontKey) ? settings.NameFontKey : "ui";
        _windowWidth = Math.Max(480, settings.WindowWidth);
        _windowHeight = Math.Max(640, settings.WindowHeight);
    }

    public event EventHandler? SettingsChanged;

    public ObservableCollection<VoiceMemberViewModel> Members { get; } = [];

    public Array LayoutOptions { get; }

    public IReadOnlyList<NameFontOption> FontOptions { get; }

    public MonitorLayout SelectedLayout
    {
        get => _selectedLayout;
        set
        {
            if (!SetProperty(ref _selectedLayout, value)) return;
            OnPropertyChanged(nameof(IsDebugLayout));
            OnPropertyChanged(nameof(IsOverlayLayout));
            OnPropertyChanged(nameof(IsDadLayout));
            OnPropertyChanged(nameof(ShowGapSetting));
            OnPropertyChanged(nameof(ShowNameSetting));
            OnPropertyChanged(nameof(ShowDadAvatarSetting));
            RefreshMemberPresentation();
            PersistSettings();
        }
    }

    public bool IsDebugLayout => SelectedLayout == MonitorLayout.Debug;

    public bool IsOverlayLayout => SelectedLayout == MonitorLayout.Overlay;

    public bool IsDadLayout => SelectedLayout == MonitorLayout.Dad;

    public bool ShowGapSetting => IsOverlayLayout || IsDadLayout;

    public bool ShowNameSetting => IsOverlayLayout || IsDadLayout;

    public bool ShowDadAvatarSetting => IsDadLayout;

    public string BackgroundColorHex
    {
        get => _backgroundColorHex;
        set
        {
            var normalized = NormalizeColor(value);
            if (!SetProperty(ref _backgroundColorHex, normalized)) return;
            OnPropertyChanged(nameof(BackgroundBrush));
            OnPropertyChanged(nameof(DadFrameFillBrush));
            PersistSettings();
        }
    }

    public Brush BackgroundBrush => CreateBrush(BackgroundColorHex);

    public Brush DadFrameFillBrush => DadAvatarVisible ? CreateBrush("#110B03") : CreateBrush(BackgroundColorHex);

    public double ItemGap
    {
        get => _itemGap;
        set
        {
            var clamped = ClampGap(value);
            if (!SetProperty(ref _itemGap, clamped)) return;
            RefreshMemberPresentation();
            PersistSettings();
        }
    }

    public bool NameVisible
    {
        get => _nameVisible;
        set
        {
            if (!SetProperty(ref _nameVisible, value)) return;
            PersistSettings();
        }
    }

    public bool DadAvatarVisible
    {
        get => _dadAvatarVisible;
        set
        {
            if (!SetProperty(ref _dadAvatarVisible, value)) return;
            OnPropertyChanged(nameof(DadFrameFillBrush));
            PersistSettings();
        }
    }

    public bool SettingsVisible
    {
        get => _settingsVisible;
        set
        {
            if (!SetProperty(ref _settingsVisible, value)) return;
            PersistSettings();
        }
    }

    public bool SummaryVisible
    {
        get => _summaryVisible;
        set
        {
            if (!SetProperty(ref _summaryVisible, value)) return;
            PersistSettings();
        }
    }

    public string SelectedFontKey
    {
        get => _selectedFontKey;
        set
        {
            if (!FontMap.ContainsKey(value))
            {
                value = "ui";
            }

            if (!SetProperty(ref _selectedFontKey, value)) return;
            OnPropertyChanged(nameof(MemberNameFontFamily));
            PersistSettings();
        }
    }

    public FontFamily MemberNameFontFamily => new(FontMap[SelectedFontKey]);

    public string ChannelLabel
    {
        get => _channelLabel;
        private set => SetProperty(ref _channelLabel, value);
    }

    public int MemberCount
    {
        get => _memberCount;
        private set
        {
            if (!SetProperty(ref _memberCount, value)) return;
            OnPropertyChanged(nameof(HasMembers));
        }
    }

    public int SpeakingCount
    {
        get => _speakingCount;
        private set => SetProperty(ref _speakingCount, value);
    }

    public string UpdatedAtLabel
    {
        get => _updatedAtLabel;
        private set => SetProperty(ref _updatedAtLabel, value);
    }

    public bool IsConnected
    {
        get => _isConnected;
        set
        {
            if (!SetProperty(ref _isConnected, value)) return;
            OnPropertyChanged(nameof(EmptyStateText));
        }
    }

    public bool HasMembers => MemberCount > 0;

    public string EmptyStateText => IsConnected ? "現在の VC 参加者はいません" : "BetterDiscord plugin からの接続を待っています";

    public double WindowWidth
    {
        get => _windowWidth;
        private set => SetProperty(ref _windowWidth, value);
    }

    public double WindowHeight
    {
        get => _windowHeight;
        private set => SetProperty(ref _windowHeight, value);
    }

    public void ApplySnapshot(VoiceSnapshot snapshot)
    {
        IsConnected = snapshot.Connected;

        var members = snapshot.Members ?? [];
        var activeIds = members.Select(member => member.Id).ToHashSet();

        foreach (var member in members)
        {
            if (!_memberOrder.ContainsKey(member.Id))
            {
                _memberOrder[member.Id] = _nextMemberOrder++;
            }
        }

        foreach (var id in _memberOrder.Keys.Except(activeIds).ToList())
        {
            _memberOrder.Remove(id);
        }

        var orderedMembers = members
            .OrderBy(member => _memberOrder.TryGetValue(member.Id, out var order) ? order : int.MaxValue)
            .Select(member => new VoiceMemberViewModel
            {
                Id = member.Id,
                DisplayName = string.IsNullOrWhiteSpace(member.DisplayName) ? member.Username : member.DisplayName,
                Username = member.Username,
                AvatarUrl = member.AvatarUrl,
                IsSpeaking = member.Speaking,
                IsMuted = member.IsMuted,
                IsDeafened = member.IsDeafened,
                IsSelf = member.IsSelf
            })
            .ToList();

        Members.Clear();
        foreach (var member in orderedMembers)
        {
            Members.Add(member);
        }

        RefreshMemberPresentation();

        ChannelLabel = snapshot.Channel?.Name is { Length: > 0 } channelName
            ? snapshot.Channel?.GuildName is { Length: > 0 } guildName
                ? $"{guildName} / {channelName}"
                : channelName
            : "VC 未接続";

        MemberCount = Members.Count;
        SpeakingCount = Members.Count(member => member.IsSpeaking);
        UpdatedAtLabel = FormatTimestamp(snapshot.UpdatedAt);
        OnPropertyChanged(nameof(EmptyStateText));
    }

    public void CaptureWindowSize(double width, double height)
    {
        WindowWidth = Math.Max(480, width);
        WindowHeight = Math.Max(640, height);
        PersistSettings();
    }

    public AppSettings ToSettings()
    {
        return new AppSettings
        {
            Layout = SelectedLayout,
            BackgroundColorHex = BackgroundColorHex,
            ItemGap = ItemGap,
            NameVisible = NameVisible,
            DadAvatarVisible = DadAvatarVisible,
            SettingsVisible = SettingsVisible,
            SummaryVisible = SummaryVisible,
            NameFontKey = SelectedFontKey,
            WindowWidth = WindowWidth,
            WindowHeight = WindowHeight
        };
    }

    private void RefreshMemberPresentation()
    {
        for (var index = 0; index < Members.Count; index++)
        {
            var member = Members[index];
            if (SelectedLayout == MonitorLayout.Debug)
            {
                member.ItemMargin = new Thickness(0, 0, 0, 12);
                member.ZIndex = 0;
            }
            else
            {
                member.ItemMargin = index == 0
                    ? new Thickness(0)
                    : new Thickness(ItemGap, 0, 0, 0);
                member.ZIndex = member.IsSpeaking ? 2 : 1;
            }
        }
    }

    private void PersistSettings()
    {
        SettingsChanged?.Invoke(this, EventArgs.Empty);
    }

    private static string NormalizeColor(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "#07111F";
        }

        var candidate = value.Trim();
        if (!candidate.StartsWith("#", StringComparison.Ordinal))
        {
            candidate = $"#{candidate}";
        }

        return candidate.Length == 7 && int.TryParse(candidate[1..], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out _)
            ? candidate.ToUpperInvariant()
            : "#07111F";
    }

    private static double ClampGap(double value)
    {
        return Math.Max(-40, Math.Min(40, value));
    }

    private static string FormatTimestamp(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "未受信";
        }

        return DateTimeOffset.TryParse(value, out var timestamp)
            ? timestamp.ToLocalTime().ToString("HH:mm:ss")
            : "未受信";
    }

    private static SolidColorBrush CreateBrush(string hex)
    {
        var color = (Color)ColorConverter.ConvertFromString(hex);
        var brush = new SolidColorBrush(color);
        brush.Freeze();
        return brush;
    }
}

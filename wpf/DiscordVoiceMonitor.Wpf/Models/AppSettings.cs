namespace DiscordVoiceMonitor.Wpf.Models;

public sealed class AppSettings
{
    public MonitorLayout Layout { get; set; } = MonitorLayout.Dad;
    public string BackgroundColorHex { get; set; } = "#07111F";
    public double ItemGap { get; set; } = 18;
    public bool NameVisible { get; set; } = true;
    public bool DadAvatarVisible { get; set; } = true;
    public bool SettingsVisible { get; set; } = true;
    public bool SummaryVisible { get; set; } = true;
    public string NameFontKey { get; set; } = "ui";
    public double WindowWidth { get; set; } = 720;
    public double WindowHeight { get; set; } = 900;
}

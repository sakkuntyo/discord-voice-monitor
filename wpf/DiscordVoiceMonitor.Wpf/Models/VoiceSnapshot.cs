namespace DiscordVoiceMonitor.Wpf.Models;

public sealed class VoiceSnapshot
{
    public string Source { get; set; } = "betterdiscord";
    public bool Connected { get; set; }
    public VoiceChannel? Channel { get; set; }
    public string? GuildId { get; set; }
    public List<VoiceMember> Members { get; set; } = [];
    public string? UpdatedAt { get; set; }
}

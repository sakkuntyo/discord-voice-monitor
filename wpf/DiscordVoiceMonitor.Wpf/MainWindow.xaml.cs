using System.Windows;
using DiscordVoiceMonitor.Wpf.Models;
using DiscordVoiceMonitor.Wpf.Services;
using DiscordVoiceMonitor.Wpf.ViewModels;

namespace DiscordVoiceMonitor.Wpf;

public partial class MainWindow : Window
{
    private readonly SettingsService _settingsService;
    private readonly VoiceMonitorServer _server;
    private readonly MainWindowViewModel _viewModel;

    public MainWindow()
    {
        _settingsService = new SettingsService();
        _viewModel = new MainWindowViewModel(_settingsService.Load());
        _server = new VoiceMonitorServer();

        InitializeComponent();

        DataContext = _viewModel;
        Width = _viewModel.WindowWidth;
        Height = _viewModel.WindowHeight;

        _viewModel.SettingsChanged += OnSettingsChanged;
        _server.SnapshotReceived += OnSnapshotReceived;
        _server.ConnectionStateChanged += OnConnectionStateChanged;

        Loaded += OnLoaded;
        SizeChanged += OnWindowSizeChanged;
        Closed += OnClosed;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _server.Start();
    }

    private void OnSettingsChanged(object? sender, EventArgs e)
    {
        _settingsService.Save(_viewModel.ToSettings());
    }

    private void OnSnapshotReceived(object? sender, VoiceSnapshot snapshot)
    {
        Dispatcher.Invoke(() => _viewModel.ApplySnapshot(snapshot));
    }

    private void OnConnectionStateChanged(object? sender, bool connected)
    {
        Dispatcher.Invoke(() => _viewModel.IsConnected = connected);
    }

    private void OnWindowSizeChanged(object sender, SizeChangedEventArgs e)
    {
        if (WindowState != WindowState.Normal)
        {
            return;
        }

        _viewModel.CaptureWindowSize(ActualWidth, ActualHeight);
    }

    private void OnClosed(object? sender, EventArgs e)
    {
        _settingsService.Save(_viewModel.ToSettings());
        _server.Dispose();
    }
}

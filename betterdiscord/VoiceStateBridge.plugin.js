/**
 * @name VoiceStateBridge
 * @author Codex
 * @description Sends current voice participants and speaking state from BetterDiscord to a local Electron app over WebSocket.
 * @version 0.1.0
 * @source https://example.invalid/VoiceStateBridge
 */

"use strict";

module.exports = class VoiceStateBridge {
    constructor() {
        this.wsUrl = "ws://127.0.0.1:3939";
        this.snapshotIntervalMs = 200;
        this.socket = null;
        this.flushTimer = null;
        this.reconnectTimer = null;
        this.pollTimer = null;
        this.ensureConnectionTimer = null;
        this.lastSignature = "";
        this.queueSnapshot = this.queueSnapshot.bind(this);
    }

    start() {
        if (!this.resolveModules()) {
            const missing = this.getMissingModules();
            BdApi.Logger.error("[VoiceStateBridge] Missing Discord modules", missing);
            BdApi.UI.showToast(`VoiceStateBridge: missing ${missing.join(", ")}`, {type: "error"});
            return;
        }

        this.connectSocket();

        this.pollTimer = window.setInterval(this.queueSnapshot, this.snapshotIntervalMs);
        this.ensureConnectionTimer = window.setInterval(() => {
            if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
                this.connectSocket();
            }
        }, 1500);

        if (this.dispatcher?.subscribe) {
            this.dispatcher.subscribe("VOICE_STATE_UPDATES", this.queueSnapshot);
            this.dispatcher.subscribe("RTC_CONNECTION_STATE", this.queueSnapshot);
            this.dispatcher.subscribe("AUDIO_TOGGLE_SELF_MUTE", this.queueSnapshot);
            this.dispatcher.subscribe("AUDIO_TOGGLE_SELF_DEAF", this.queueSnapshot);
        }

        BdApi.UI.showToast("VoiceStateBridge started", {type: "success"});
    }

    stop() {
        if (this.dispatcher?.unsubscribe) {
            this.dispatcher.unsubscribe("VOICE_STATE_UPDATES", this.queueSnapshot);
            this.dispatcher.unsubscribe("RTC_CONNECTION_STATE", this.queueSnapshot);
            this.dispatcher.unsubscribe("AUDIO_TOGGLE_SELF_MUTE", this.queueSnapshot);
            this.dispatcher.unsubscribe("AUDIO_TOGGLE_SELF_DEAF", this.queueSnapshot);
        }

        if (this.pollTimer !== null) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }

        if (this.flushTimer !== null) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ensureConnectionTimer !== null) {
            clearInterval(this.ensureConnectionTimer);
            this.ensureConnectionTimer = null;
        }

        this.lastSignature = "";
        this.clearSocket();
    }

    resolveModules() {
        const Webpack = BdApi.Webpack;
        this.VoiceStateStore = this.findStore("VoiceStateStore", ["getVoiceStateForUser", "getVoiceStatesForChannel"]);
        this.ChannelRTCStore = this.findStore("ChannelRTCStore", ["getParticipants", "getSelectedParticipant"]);
        this.ChannelStore = this.findStore("ChannelStore", ["getChannel", "getDMFromUserId"]);
        this.GuildStore = this.findStore("GuildStore", ["getGuild", "getGuilds"]);
        this.SelectedGuildStore = this.findStore("SelectedGuildStore", ["getGuildId"]);
        this.UserStore = this.findStore("UserStore", ["getCurrentUser", "getUser"]);
        this.dispatcher = Webpack.getByKeys("dispatch", "subscribe", "unsubscribe")
            || Webpack.getByKeys("dispatch", "wait");

        return this.getMissingModules().length === 0;
    }

    getMissingModules() {
        return [
            !this.VoiceStateStore && "VoiceStateStore",
            !this.ChannelRTCStore && "ChannelRTCStore",
            !this.ChannelStore && "ChannelStore",
            !this.UserStore && "UserStore",
        ].filter(Boolean);
    }

    findStore(name, keys) {
        const Webpack = BdApi.Webpack;
        const Filters = Webpack.Filters;

        return Webpack.Stores?.[name]
            || Webpack.getStore?.(name)
            || Webpack.getModule?.(Filters.byStoreName(name))
            || Webpack.getByKeys?.(...keys);
    }

    connectSocket() {
        this.clearSocket();

        try {
            this.socket = new WebSocket(this.wsUrl);
        } catch (error) {
            console.error("[VoiceStateBridge] Failed to create WebSocket", error);
            this.scheduleReconnect();
            return;
        }

        this.socket.addEventListener("open", () => {
            BdApi.Logger.log("[VoiceStateBridge] Connected to local Electron app");
            this.lastSignature = "";
            this.queueSnapshot();
        });

        this.socket.addEventListener("message", () => {
            this.lastSignature = "";
            this.queueSnapshot();
        });

        this.socket.addEventListener("close", () => {
            this.socket = null;
            this.scheduleReconnect();
        });

        this.socket.addEventListener("error", error => {
            console.error("[VoiceStateBridge] WebSocket error", error);
            this.clearSocket();
            this.scheduleReconnect();
        });
    }

    clearSocket() {
        if (!this.socket) return;
        this.socket.close();
        this.socket = null;
    }

    scheduleReconnect() {
        if (this.reconnectTimer !== null) return;

        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connectSocket();
        }, 1500);
    }

    queueSnapshot() {
        if (this.flushTimer !== null) return;
        this.flushTimer = window.setTimeout(() => this.flushSnapshot(), 0);
    }

    flushSnapshot() {
        this.flushTimer = null;

        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

        const snapshot = this.buildSnapshot();
        const signature = JSON.stringify({
            channel: snapshot.channel,
            guildId: snapshot.guildId,
            members: snapshot.members
        });

        if (signature === this.lastSignature) return;

        this.lastSignature = signature;
        this.socket.send(JSON.stringify(snapshot));
    }

    buildSnapshot() {
        const currentUser = this.UserStore.getCurrentUser?.();
        const selfVoiceState = currentUser ? this.VoiceStateStore.getVoiceStateForUser?.(currentUser.id) : null;
        const channelId = selfVoiceState?.channelId ?? null;
        const guildId = selfVoiceState?.guildId ?? this.SelectedGuildStore?.getGuildId?.() ?? null;

        if (!channelId) {
            return {
                source: "betterdiscord",
                channel: null,
                guildId,
                members: [],
                updatedAt: new Date().toISOString()
            };
        }

        const channel = this.ChannelStore.getChannel?.(channelId);
        const guild = guildId ? this.GuildStore?.getGuild?.(guildId) : null;
        const participants = this.ChannelRTCStore.getParticipants?.(channelId) ?? [];

        const members = participants
            .filter(participant => participant?.user && typeof participant?.speaking === "boolean")
            .map(participant => {
                const user = participant.user;
                const voiceState = participant.voiceState ?? this.VoiceStateStore.getVoiceStateForUser?.(user.id);
                return {
                    id: user.id,
                    username: user.username ?? "",
                    displayName: participant.userNick || user.globalName || user.username || "Unknown User",
                    avatarUrl: this.getAvatarUrl(user),
                    speaking: Boolean(participant.speaking),
                    isMuted: Boolean(voiceState?.mute || voiceState?.selfMute),
                    isDeafened: Boolean(voiceState?.deaf || voiceState?.selfDeaf),
                    isSelf: user.id === currentUser?.id
                };
            })
            .sort((left, right) => {
                if (left.speaking !== right.speaking) return left.speaking ? -1 : 1;
                return left.displayName.localeCompare(right.displayName, "ja");
            });

        return {
            source: "betterdiscord",
            channel: {
                id: channelId,
                name: channel?.name ?? "Unknown Channel",
                guildId,
                guildName: guild?.name ?? null
            },
            guildId,
            members,
            updatedAt: new Date().toISOString()
        };
    }

    getAvatarUrl(user) {
        if (!user) return null;

        if (typeof user.getAvatarURL === "function") {
            return user.getAvatarURL(null, 128, true);
        }

        if (typeof user.avatar === "string") {
            return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
        }

        return null;
    }
};

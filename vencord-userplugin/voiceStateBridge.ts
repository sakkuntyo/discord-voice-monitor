/*
 * Place this file in your Vencord checkout as:
 * src/userplugins/voiceStateBridge.ts
 */

import definePlugin from "@utils/types";
import { ChannelRTCStore, ChannelStore, FluxDispatcher, GuildStore, SelectedGuildStore, UserStore, VoiceStateStore } from "@webpack/common";

const WS_URL = "ws://127.0.0.1:3939";
const SNAPSHOT_INTERVAL_MS = 200;

type VoiceSnapshotMember = {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    speaking: boolean;
    isMuted: boolean;
    isDeafened: boolean;
    isSelf: boolean;
};

type VoiceSnapshot = {
    source: "vencord";
    channel: {
        id: string;
        name: string;
        guildId: string | null;
        guildName: string | null;
    } | null;
    guildId: string | null;
    members: VoiceSnapshotMember[];
    updatedAt: string;
};

let socket: WebSocket | null = null;
let flushTimer: number | null = null;
let reconnectTimer: number | null = null;
let pollTimer: number | null = null;
let lastSerializedSnapshot = "";

function scheduleReconnect() {
    if (reconnectTimer != null) return;

    reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connectSocket();
    }, 1500);
}

function clearSocket() {
    if (!socket) return;
    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.close();
    socket = null;
}

function avatarUrlForUser(user: any) {
    if (!user) return null;
    if (typeof user.getAvatarURL === "function") {
        return user.getAvatarURL(null, 128, true);
    }

    if (typeof user.avatar === "string") {
        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
    }

    return null;
}

function buildSnapshot(): VoiceSnapshot {
    const currentUser = UserStore.getCurrentUser();
    const selfVoiceState = currentUser ? VoiceStateStore.getVoiceStateForUser(currentUser.id) : null;
    const channelId = selfVoiceState?.channelId ?? null;
    const guildId = selfVoiceState?.guildId ?? SelectedGuildStore.getGuildId() ?? null;

    if (!channelId) {
        return {
            source: "vencord",
            channel: null,
            guildId,
            members: [],
            updatedAt: new Date().toISOString()
        };
    }

    const channel = ChannelStore.getChannel(channelId);
    const guildName = guildId ? GuildStore.getGuild(guildId)?.name ?? null : null;
    const participants = ChannelRTCStore.getParticipants(channelId) ?? [];

    const members = participants
        .filter((participant: any) => participant?.user && typeof participant?.speaking === "boolean")
        .map((participant: any) => {
            const user = participant.user;
            const voiceState = participant.voiceState ?? VoiceStateStore.getVoiceStateForUser(user.id);
            return {
                id: user.id,
                username: user.username ?? "",
                displayName: participant.userNick || user.globalName || user.username || "Unknown User",
                avatarUrl: avatarUrlForUser(user),
                speaking: Boolean(participant.speaking),
                isMuted: Boolean(voiceState?.mute || voiceState?.selfMute),
                isDeafened: Boolean(voiceState?.deaf || voiceState?.selfDeaf),
                isSelf: user.id === currentUser?.id
            };
        })
        .sort((left: VoiceSnapshotMember, right: VoiceSnapshotMember) => {
            if (left.speaking !== right.speaking) return left.speaking ? -1 : 1;
            return left.displayName.localeCompare(right.displayName, "ja");
        });

    return {
        source: "vencord",
        channel: {
            id: channelId,
            name: channel?.name ?? "Unknown Channel",
            guildId,
            guildName
        },
        guildId,
        members,
        updatedAt: new Date().toISOString()
    };
}

function flushSnapshot() {
    flushTimer = null;

    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    const snapshot = buildSnapshot();
    const signature = JSON.stringify({
        channel: snapshot.channel,
        guildId: snapshot.guildId,
        members: snapshot.members
    });

    if (signature === lastSerializedSnapshot) return;

    lastSerializedSnapshot = signature;
    socket.send(JSON.stringify(snapshot));
}

function queueSnapshot() {
    if (flushTimer != null) return;
    flushTimer = window.setTimeout(flushSnapshot, 0);
}

function connectSocket() {
    clearSocket();

    try {
        socket = new WebSocket(WS_URL);
    } catch (error) {
        console.error("[voiceStateBridge] Failed to create WebSocket:", error);
        scheduleReconnect();
        return;
    }

    socket.onopen = () => {
        queueSnapshot();
    };

    socket.onclose = () => {
        socket = null;
        scheduleReconnect();
    };

    socket.onerror = error => {
        console.error("[voiceStateBridge] WebSocket error:", error);
    };
}

export default definePlugin({
    name: "voiceStateBridge",
    description: "Sends current voice participants and speaking state to a local Electron app.",
    authors: [
        {
            name: "Codex",
            id: 0n
        }
    ],
    requiresRestart: false,
    start() {
        connectSocket();

        pollTimer = window.setInterval(queueSnapshot, SNAPSHOT_INTERVAL_MS);

        FluxDispatcher.subscribe("VOICE_STATE_UPDATES", queueSnapshot);
        FluxDispatcher.subscribe("RTC_CONNECTION_STATE", queueSnapshot);
        FluxDispatcher.subscribe("AUDIO_TOGGLE_SELF_MUTE", queueSnapshot);
        FluxDispatcher.subscribe("AUDIO_TOGGLE_SELF_DEAF", queueSnapshot);
    },
    stop() {
        if (pollTimer != null) {
            clearInterval(pollTimer);
            pollTimer = null;
        }

        if (flushTimer != null) {
            clearTimeout(flushTimer);
            flushTimer = null;
        }

        if (reconnectTimer != null) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        FluxDispatcher.unsubscribe("VOICE_STATE_UPDATES", queueSnapshot);
        FluxDispatcher.unsubscribe("RTC_CONNECTION_STATE", queueSnapshot);
        FluxDispatcher.unsubscribe("AUDIO_TOGGLE_SELF_MUTE", queueSnapshot);
        FluxDispatcher.unsubscribe("AUDIO_TOGGLE_SELF_DEAF", queueSnapshot);

        lastSerializedSnapshot = "";
        clearSocket();
    }
});

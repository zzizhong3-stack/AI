import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Message } from "../types";

interface Props {
  message: Message;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>J</Text>
        </View>
      )}

      <View style={styles.messageContent}>
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.text, isUser ? styles.userText : styles.assistantText]}>
            {message.content}
          </Text>
        </View>
        <Text style={[styles.time, isUser ? styles.timeRight : styles.timeLeft]}>
          {formatTime(message.created_at)}
        </Text>
      </View>

      {isUser && (
        <View style={[styles.avatar, styles.userAvatar]}>
          <Text style={styles.avatarText}>我</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginVertical: 4,
    paddingHorizontal: 12,
    alignItems: "flex-end",
  },
  userContainer: {
    justifyContent: "flex-end",
  },
  assistantContainer: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e91e63",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  userAvatar: {
    marginLeft: 8,
    marginRight: 0,
    backgroundColor: "#2196f3",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  messageContent: {
    flex: 1,  // 给 inner View 确定宽度，让 maxWidth: "75%" 正确解析
  },
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: "#2196f3",
    borderBottomRightRadius: 4,
    alignSelf: "flex-end",  // 短消息不拉伸，保持内容宽度
  },
  assistantBubble: {
    backgroundColor: "#2a2a3e",
    borderBottomLeftRadius: 4,
    alignSelf: "flex-start",  // 短消息不拉伸，保持内容宽度
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: "#fff",
  },
  assistantText: {
    color: "#e0e0e0",
  },
  time: {
    fontSize: 10,
    color: "#555",
    marginTop: 2,
  },
  timeLeft: {
    marginLeft: 4,
    textAlign: "left",
  },
  timeRight: {
    marginRight: 4,
    textAlign: "right",
  },
});

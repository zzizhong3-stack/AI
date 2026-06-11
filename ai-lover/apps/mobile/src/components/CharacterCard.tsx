import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Character } from "../types";

interface Props {
  character: Character;
  onPress: () => void;
}

export default function CharacterCard({ character, onPress }: Props) {
  const tagColors: Record<string, string> = {
    御姐: "#e91e63",
    毒舌: "#ff5722",
    年上: "#9c27b0",
    知识型: "#2196f3",
    理性: "#009688",
    温柔: "#ff9800",
    活泼: "#4caf50",
    傲娇: "#f44336",
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* 头像占位 */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {character.name.slice(0, 1)}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{character.name}</Text>
        <Text style={styles.personality} numberOfLines={2}>
          {character.personality}
        </Text>

        {/* 标签 */}
        <View style={styles.tags}>
          {(character.tags || []).slice(0, 4).map((tag) => (
            <View
              key={tag}
              style={[
                styles.tag,
                { backgroundColor: (tagColors[tag] || "#666") + "22" },
              ]}
            >
              <Text style={[styles.tagText, { color: tagColors[tag] || "#999" }]}>
                {tag}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.chatCount}>
          💬 {character.chat_count || 0} 次聊天
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#1e1e2e",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2a2a3e",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#e91e63",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  personality: {
    fontSize: 13,
    color: "#999",
    lineHeight: 18,
    marginBottom: 8,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  chatCount: {
    fontSize: 12,
    color: "#666",
  },
});

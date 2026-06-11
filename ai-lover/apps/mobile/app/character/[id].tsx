import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getCharacters, createConversation } from "../../src/services/api";
import { Character } from "../../src/types";

export default function CharacterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getCharacters()
      .then((data) => {
        const found = data.characters.find((c) => c.id === id);
        setCharacter(found || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleStartChat = async () => {
    if (!character || starting) return;
    setStarting(true);
    try {
      const data = await createConversation();
      router.replace(`/chat/${data.conversation_id}`);
    } catch (err) {
      console.error("创建对话失败:", err);
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e91e63" />
      </View>
    );
  }

  if (!character) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>人设不存在</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarLarge}>
        <Text style={styles.avatarText}>{character.name.slice(0, 1)}</Text>
      </View>
      <Text style={styles.name}>{character.name}</Text>
      <Text style={styles.gender}>
        {character.gender === "female" ? "👩 女性" : "👨 男性"}
        {" · "}
        {character.tags?.[0] || ""}
      </Text>
      <View style={styles.tags}>
        {(character.tags || []).map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>性格</Text>
        <Text style={styles.sectionText}>{character.personality}</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{character.chat_count || 0}</Text>
          <Text style={styles.statLabel}>总对话</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.startBtn, starting && styles.startBtnDisabled]}
        onPress={handleStartChat}
        disabled={starting}
        activeOpacity={0.8}
      >
        <Text style={styles.startBtnText}>
          {starting ? "创建中..." : "💬 开始聊天"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#12121a" },
  content: { alignItems: "center", paddingHorizontal: 20, paddingTop: 30, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: "#12121a", justifyContent: "center", alignItems: "center" },
  avatarLarge: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "#e91e63", justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  avatarText: { fontSize: 42, fontWeight: "700", color: "#fff" },
  name: { fontSize: 26, fontWeight: "700", color: "#fff", marginBottom: 4 },
  gender: { fontSize: 14, color: "#999", marginBottom: 14 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 24 },
  tag: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, backgroundColor: "#e91e6322" },
  tagText: { fontSize: 13, fontWeight: "600", color: "#e91e63" },
  section: { width: "100%", backgroundColor: "#1e1e2e", borderRadius: 14, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#e91e63", marginBottom: 8 },
  sectionText: { fontSize: 15, color: "#ccc", lineHeight: 24 },
  statsRow: { flexDirection: "row", marginBottom: 24, marginTop: 8 },
  stat: { alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "#1e1e2e", borderRadius: 12 },
  statNumber: { fontSize: 22, fontWeight: "700", color: "#fff" },
  statLabel: { fontSize: 12, color: "#888", marginTop: 2 },
  startBtn: { width: "100%", backgroundColor: "#e91e63", borderRadius: 28, paddingVertical: 16, alignItems: "center" },
  startBtnDisabled: { backgroundColor: "#555" },
  startBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  errorText: { color: "#999", fontSize: 16 },
});

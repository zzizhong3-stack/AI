import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  getConversations, createConversation, deleteConversation,
  getCharacters,
} from "../../src/services/api";
import { Conversation, Character } from "../../src/types";

export default function ChatsScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState<Character | null>(null);
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      const [convData, charData] = await Promise.all([
        getConversations(),
        getCharacters().catch(() => null),
      ]);
      setConversations(convData.conversations);
      if (charData?.characters[0]) setCharacter(charData.characters[0]);
    } catch (err) {
      console.error("加载失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData])
  );

  const handleNewChat = async () => {
    try {
      const data = await createConversation();
      router.push(`/chat/${data.conversation_id}`);
    } catch (err) {
      console.error("创建对话失败:", err);
    }
  };

  const handleDelete = (conv: Conversation) => {
    Alert.alert("删除对话", "确定要删除这个对话吗？所有消息都会被清除。", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteConversation(conv.id);
            setConversations((prev) => prev.filter((c) => c.id !== conv.id));
          } catch (e: any) {
            Alert.alert("删除失败", e.message || "请重试");
          }
        },
      },
    ]);
  };

  const charName = character?.name || "Jinceia";
  const charAvatar = character?.avatar_url || null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e91e63" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chatItem}
            onPress={() => router.push(`/chat/${item.id}`)}
            onLongPress={() => handleDelete(item)}
            activeOpacity={0.7}
          >
            {charAvatar ? (
              <Image source={{ uri: charAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>{charName.slice(0, 1)}</Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.name}>{charName}</Text>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.last_message || "点击开始聊天"}
              </Text>
            </View>
            <View style={styles.meta}>
              <Text style={styles.time}>
                {item.updated_at
                  ? new Date(item.updated_at).toLocaleDateString("zh-CN")
                  : ""}
              </Text>
              {item.message_count > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.message_count}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>还没有对话</Text>
            <TouchableOpacity style={styles.newChatBtn} onPress={handleNewChat}>
              <Text style={styles.newChatBtnText}>开始新对话</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={handleNewChat} activeOpacity={0.8}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#12121a" },
  center: { flex: 1, backgroundColor: "#12121a", justifyContent: "center", alignItems: "center" },
  list: { paddingVertical: 4 },
  chatItem: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: "#1e1e2e",
  },
  avatar: { width: 52, height: 52, borderRadius: 26, marginRight: 12 },
  avatarPlaceholder: { backgroundColor: "#e91e63", justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 22, fontWeight: "700", color: "#fff" },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: "600", color: "#fff", marginBottom: 3 },
  lastMessage: { fontSize: 13, color: "#888", maxWidth: "90%" },
  meta: { alignItems: "flex-end" },
  time: { fontSize: 11, color: "#666", marginBottom: 4 },
  badge: { backgroundColor: "#e91e63", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  fab: {
    position: "absolute", right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#e91e63",
    justifyContent: "center", alignItems: "center",
    elevation: 6,
    shadowColor: "#e91e63", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8,
  },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "400", marginTop: -2 },
  emptyContainer: { alignItems: "center", paddingTop: 100 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: "#999", fontSize: 16, marginBottom: 20 },
  newChatBtn: { backgroundColor: "#e91e63", borderRadius: 24, paddingHorizontal: 28, paddingVertical: 12 },
  newChatBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

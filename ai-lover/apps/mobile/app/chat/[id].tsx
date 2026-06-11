import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  View, FlatList, StyleSheet, ActivityIndicator, Text,
  KeyboardAvoidingView, Platform, StatusBar, Image, TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MessageBubble from "../../src/components/MessageBubble";
import ChatInput from "../../src/components/ChatInput";
import { getMessages, sendMessage, getCharacters } from "../../src/services/api";
import { Message, Character } from "../../src/types";

const STATUSBAR_HEIGHT = Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 0;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [character, setCharacter] = useState<Character | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // 加载角色信息
  useEffect(() => {
    getCharacters().then((d) => {
      if (d.characters[0]) setCharacter(d.characters[0]);
    }).catch(() => {});
  }, []);

  const loadMessages = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getMessages(id);
      setMessages(data.messages);
    } catch (err) {
      console.error("加载消息失败:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const handleSend = async (content: string) => {
    if (!id || sending) return;
    const userMsg: Message = {
      id: `temp-${Date.now()}`, conversation_id: id, role: "user",
      content, tokens_used: 0, created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setStreamingContent("");

    let aiContent = "";

    try {
      const stream = sendMessage(id, content);
      for await (const event of stream) {
        if (event.type === "delta") {
          aiContent += event.content;
          setStreamingContent(aiContent);
        } else if (event.type === "done") {
          const aiMsg: Message = {
            id: `ai-${Date.now()}`, conversation_id: id, role: "assistant",
            content: aiContent, tokens_used: event.tokensUsed,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, aiMsg]);
          setStreamingContent("");
        }
      }
    } catch (err) {
      console.error("发送失败:", err);
      // 如果已有部分 AI 内容，保留为不完整消息，避免丢失已生成的内容
      if (aiContent) {
        const partialMsg: Message = {
          id: `ai-${Date.now()}`, conversation_id: id, role: "assistant",
          content: aiContent + "\n\n[连接中断]",
          tokens_used: 0, created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, partialMsg]);
      }
      setStreamingContent("");
    } finally {
      setSending(false);
    }
  };

  // 将 streaming content 注入 FlatList data，让列表随内容增长自动滚动
  const displayMessages = useMemo(() => {
    if (!streamingContent) return messages;
    const streamMsg: Message = {
      id: "__streaming__",
      conversation_id: id ?? "",
      role: "assistant",
      content: streamingContent,
      tokens_used: 0,
      created_at: new Date().toISOString(),
    };
    return [...messages, streamMsg];
  }, [messages, streamingContent, id]);

  // 自动滚到底部：用 onContentSizeChange 替代 setTimeout，更可靠
  const handleContentSizeChange = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: false });
  }, []);

  const charName = character?.name || "Jinceia";
  const charAvatar = character?.avatar_url || null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e91e63" />
      </View>
    );
  }

  const chatContent = (
    <View style={styles.flex}>
      <FlatList
        ref={flatListRef}
        data={displayMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.messageList}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={handleContentSizeChange}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyIcon}>💕</Text>
            <Text style={styles.emptyText}>开始和 {charName} 聊天吧</Text>
            <Text style={styles.emptyHint}>她正在等你开口...</Text>
          </View>
        }
      />
      <ChatInput onSend={handleSend} disabled={sending} />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 自定义顶部栏 — paddingTop 适配状态栏高度 */}
      <View style={[styles.header, { paddingTop: STATUSBAR_HEIGHT + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#e91e63" />
        </TouchableOpacity>
        {charAvatar ? (
          <Image source={{ uri: charAvatar }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
            <Text style={styles.headerAvatarText}>{charName.slice(0, 1)}</Text>
          </View>
        )}
        <Text style={styles.headerName} numberOfLines={1}>{charName}</Text>
      </View>

      {/* Android 用 "pan" 模式由系统处理键盘，这里只用 KeyboardAvoidingView 处理 iOS */}
      {Platform.OS === "ios" ? (
        <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={0}>
          {chatContent}
        </KeyboardAvoidingView>
      ) : (
        chatContent
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#12121a" },
  flex: { flex: 1 },
  center: { flex: 1, backgroundColor: "#12121a", justifyContent: "center", alignItems: "center" },

  // 顶部栏（paddingTop 由内联样式动态设置以适配状态栏）
  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#1a1a2e", paddingBottom: 10,
    paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#2a2a3e",
  },
  backBtn: { marginRight: 8, padding: 4 },
  headerAvatar: { width: 34, height: 34, borderRadius: 17, marginRight: 10 },
  headerAvatarPlaceholder: { backgroundColor: "#e91e63", justifyContent: "center", alignItems: "center" },
  headerAvatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  headerName: { fontSize: 17, fontWeight: "600", color: "#fff", flex: 1 },

  messageList: { paddingVertical: 12, flexGrow: 1 },

  emptyChat: { alignItems: "center", paddingTop: 100 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  emptyHint: { color: "#888", fontSize: 14, marginTop: 6 },
});

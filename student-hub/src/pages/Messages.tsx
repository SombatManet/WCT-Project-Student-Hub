import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { Send, MessageCircle, Plus, X } from 'lucide-react';
import { Layout } from '@/components/Layout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Conversation {
  otherUserId: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

interface Recipient {
  id: string;
  username: string;
  email: string;
  role: string;
}

interface AvailableUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

export default function Messages() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (showNewConversation) {
      fetchAvailableUsers();
    }
  }, [showNewConversation, selectedRole, searchQuery]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const response = await api.get('/messages/conversations');
      setConversations(response.data.data.conversations || []);
    } catch (error: any) {
      console.error('Failed to fetch conversations:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load conversations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (selectedRole) params.append('role', selectedRole);
      if (searchQuery) params.append('search', searchQuery);

      const response = await api.get(`/messages/users/available?${params}`);
      setAvailableUsers(response.data.data.users || []);
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchMessages = async (conversation: Conversation) => {
    try {
      const response = await api.get(`/messages/${conversation.otherUserId}`);
      setMessages(response.data.data.messages || []);
      setRecipient(response.data.data.recipient);
      setSelectedConversation(conversation);
    } catch (error: any) {
      console.error('Failed to fetch messages:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load messages',
        variant: 'destructive',
      });
    }
  };

  const startNewConversation = async (userId: string) => {
    const selectedUser = availableUsers.find((u) => u.id === userId);
    if (!selectedUser) return;

    const newConversation: Conversation = {
      otherUserId: userId,
      lastMessage: '',
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
      user: selectedUser,
    };

    setSelectedConversation(newConversation);
    setMessages([]);
    setRecipient(selectedUser);
    setShowNewConversation(false);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);
    try {
      const response = await api.post('/messages', {
        recipientId: selectedConversation.otherUserId,
        message: newMessage,
      });

      setMessages([...messages, response.data.data.message]);
      setNewMessage('');
      fetchConversations(); // Refresh conversations to update last message
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Layout>
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold">Messages</h1>
          <Button onClick={() => setShowNewConversation(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Message
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Conversations List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading conversations...
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No conversations yet
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {conversations.map((conv) => (
                      <button
                        key={conv.otherUserId}
                        onClick={() => fetchMessages(conv)}
                        className={`w-full text-left p-3 rounded-lg border transition ${
                          selectedConversation?.otherUserId === conv.otherUserId
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{conv.user.username}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {conv.user.role}
                            </p>
                            <p className="text-sm text-muted-foreground truncate mt-1">
                              {conv.lastMessage}
                            </p>
                          </div>
                          {conv.unreadCount > 0 && (
                            <Badge variant="default">{conv.unreadCount}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatTime(conv.lastMessageTime)}
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Messages View */}
          <Card className="lg:col-span-2">
            {selectedConversation && recipient ? (
              <div className="flex flex-col h-96 md:h-96 lg:h-96">
                <CardHeader className="border-b">
                  <CardTitle className="text-lg">{recipient.username}</CardTitle>
                  <p className="text-sm text-muted-foreground">{recipient.role}</p>
                </CardHeader>

                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No messages yet. Start the conversation!
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${
                            msg.sender_id === user?.id ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-xs px-4 py-2 rounded-lg ${
                              msg.sender_id === user?.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm break-words">{msg.message}</p>
                            <p className="text-xs mt-1 opacity-70">
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                <div className="border-t p-4">
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <Input
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={sending}
                    />
                    <Button type="submit" disabled={!newMessage.trim() || sending}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </div>
            ) : (
              <CardContent className="flex items-center justify-center h-96">
                <p className="text-muted-foreground">
                  Select a conversation to view messages
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* New Conversation Dialog */}
      <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start New Conversation</DialogTitle>
            <DialogDescription>
              Select a user to message
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Role Filter */}
            <div className="flex gap-2">
              <Button
                variant={selectedRole === '' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedRole('')}
              >
                All
              </Button>
              <Button
                variant={selectedRole === 'teacher' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedRole('teacher')}
              >
                Teachers
              </Button>
              <Button
                variant={selectedRole === 'student' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedRole('student')}
              >
                Students
              </Button>
            </div>

            {/* User List */}
            <ScrollArea className="h-64 border rounded-lg p-2">
              {loadingUsers ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Loading users...
                </div>
              ) : availableUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No users found
                </div>
              ) : (
                <div className="space-y-2">
                  {availableUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => startNewConversation(u.id)}
                      className="w-full text-left p-3 rounded-lg border hover:bg-muted transition"
                    >
                      <p className="font-medium">{u.username}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {u.role}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

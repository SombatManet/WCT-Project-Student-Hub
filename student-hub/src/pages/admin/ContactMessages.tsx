import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { Trash2, Mail, Archive, MailOpen, Send, CheckCircle2 } from 'lucide-react';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  status: 'unread' | 'read' | 'archived';
  admin_reply?: string;
  replied_at?: string;
  created_at: string;
  updated_at: string;
}

export default function ContactMessages() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const fetchMessages = async (status?: string) => {
    setLoading(true);
    try {
      const url = status && status !== 'all' ? `/contact?status=${status}` : '/contact';
      const response = await api.get(url);
      setMessages(response.data.data.messages || []);
    } catch (error: any) {
      console.error('Failed to fetch messages:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load messages',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages(activeTab === 'all' ? undefined : activeTab);
  }, [activeTab]);

  const updateStatus = async (id: string, status: 'read' | 'archived') => {
    try {
      await api.patch(`/contact/${id}`, { status });
      toast({
        title: 'Success',
        description: `Message marked as ${status}`,
      });
      fetchMessages(activeTab === 'all' ? undefined : activeTab);
      setSelectedMessage(null);
    } catch (error: any) {
      console.error('Failed to update status:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update message',
        variant: 'destructive',
      });
    }
  };

  const deleteMessage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      await api.delete(`/contact/${id}`);
      toast({
        title: 'Success',
        description: 'Message deleted successfully',
      });
      fetchMessages(activeTab === 'all' ? undefined : activeTab);
      setSelectedMessage(null);
    } catch (error: any) {
      console.error('Failed to delete message:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete message',
        variant: 'destructive',
      });
    }
  };

  const sendReply = async () => {
    if (!selectedMessage || !replyText.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a reply message',
        variant: 'destructive',
      });
      return;
    }

    setSendingReply(true);
    try {
      await api.post(`/contact/${selectedMessage.id}/reply`, { reply: replyText.trim() });
      toast({
        title: 'Success',
        description: 'Reply sent successfully',
      });
      setReplyText('');
      fetchMessages(activeTab === 'all' ? undefined : activeTab);
      
      // Update selected message with reply
      if (selectedMessage) {
        setSelectedMessage({
          ...selectedMessage,
          admin_reply: replyText.trim(),
          replied_at: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error('Failed to send reply:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to send reply',
        variant: 'destructive',
      });
    } finally {
      setSendingReply(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      unread: 'default',
      read: 'secondary',
      archived: 'outline',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const stats = {
    total: messages.length,
    unread: messages.filter((m) => m.status === 'unread').length,
    read: messages.filter((m) => m.status === 'read').length,
    archived: messages.filter((m) => m.status === 'archived').length,
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Contact Messages</CardTitle>
          <CardDescription>
            Manage contact form submissions from users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Unread</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.unread}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Read</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.read}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Archived</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.archived}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="read">Read</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No messages found
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="hidden md:table-cell">Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden sm:table-cell">Reply</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {messages.map((message) => (
                        <TableRow
                          key={message.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedMessage(message)}
                        >
                          <TableCell className="font-medium">
                            {message.name}
                          </TableCell>
                          <TableCell>{message.email}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {formatDate(message.created_at)}
                          </TableCell>
                          <TableCell>{getStatusBadge(message.status)}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {message.admin_reply ? (
                              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Replied
                              </Badge>
                            ) : (
                              <Badge variant="secondary">No Reply</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {message.status === 'unread' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatus(message.id, 'read');
                                  }}
                                >
                                  <MailOpen className="h-4 w-4" />
                                </Button>
                              )}
                              {message.status !== 'archived' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatus(message.id, 'archived');
                                  }}
                                >
                                  <Archive className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteMessage(message.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Message Detail Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message from {selectedMessage?.name}</DialogTitle>
            <DialogDescription>
              {selectedMessage?.email} • {selectedMessage && formatDate(selectedMessage.created_at)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="mb-2">
                Status: {selectedMessage && getStatusBadge(selectedMessage.status)}
              </div>
            </div>
            <div className="rounded-md bg-muted p-4">
              <p className="whitespace-pre-wrap">{selectedMessage?.message}</p>
            </div>

            {/* Admin Reply Section */}
            {selectedMessage?.admin_reply && (
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold mb-2 block">Admin Reply:</Label>
                <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-800">
                  <p className="whitespace-pre-wrap text-sm">{selectedMessage.admin_reply}</p>
                  {selectedMessage.replied_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Replied on {formatDate(selectedMessage.replied_at)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Reply Form */}
            {!selectedMessage?.admin_reply && (
              <div className="border-t pt-4">
                <Label htmlFor="reply" className="text-sm font-semibold mb-2 block">
                  Send Reply:
                </Label>
                <Textarea
                  id="reply"
                  placeholder="Type your reply here..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  className="mb-2"
                />
                <Button 
                  onClick={sendReply} 
                  disabled={sendingReply || !replyText.trim()}
                  className="w-full"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sendingReply ? 'Sending...' : 'Send Reply'}
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              {selectedMessage?.status === 'unread' && (
                <Button
                  onClick={() => updateStatus(selectedMessage.id, 'read')}
                  variant="outline"
                >
                  <MailOpen className="mr-2 h-4 w-4" />
                  Mark as Read
                </Button>
              )}
              {selectedMessage?.status !== 'archived' && (
                <Button
                  onClick={() => updateStatus(selectedMessage.id, 'archived')}
                  variant="outline"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </Button>
              )}
              <Button
                onClick={() => deleteMessage(selectedMessage!.id)}
                variant="destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

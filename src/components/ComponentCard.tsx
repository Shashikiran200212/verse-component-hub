import React, { useState } from 'react';
import { Heart, Bookmark, Eye, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Component = Tables<'components'> & {
  profiles: Tables<'profiles'> | null;
  is_liked?: boolean;
  is_saved?: boolean;
};

interface ComponentCardProps {
  component: Component;
  onLike?: () => void;
  onSave?: () => void;
  onExpand?: () => void;
  onDelete?: () => void;
}

const ComponentCard: React.FC<ComponentCardProps> = ({
  component,
  onLike,
  onSave,
  onExpand,
  onDelete
}) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(component.is_liked || false);
  const [isSaved, setIsSaved] = useState(component.is_saved || false);
  const [likesCount, setLikesCount] = useState(component.likes_count || 0);
  const [savesCount, setSavesCount] = useState(component.saves_count || 0);
  const [showModal, setShowModal] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(component.code);
      toast.success('Code copied!');
    } catch {
      toast.error('Failed to copy code');
    }
  };

  const handleDelete = async () => {
    if (!user || user.id !== component.user_id) return;
    if (!window.confirm('Are you sure you want to delete this component?')) return;
    try {
      const { error } = await supabase
        .from('components')
        .delete()
        .eq('id', component.id)
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success('Component deleted');
      // Call the callback immediately after successful deletion
      if (onDelete) {
        onDelete();
      }
    } catch (error) {
      toast.error('Failed to delete component');
    }
  };

  const renderOutput = () => {
    if (!component.code) return null;
    return (
      <iframe
        title="Component Output"
        srcDoc={component.code}
        style={{
          width: '100%',
          height: 200,
          border: '1px solid #333',
          borderRadius: '0.5rem',
          background: '#fff'
        }}
        sandbox="allow-scripts allow-same-origin"
      />
    );
  };

  const handleLike = async () => {
    if (!user) {
      toast.error('Please sign in to like components');
      return;
    }

    try {
      if (isLiked) {
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('component_id', component.id);

        // Update likes_count in components table
        await supabase
          .from('components')
          .update({ likes_count: (likesCount || 1) - 1 })
          .eq('id', component.id);

        setIsLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        await supabase
          .from('likes')
          .insert({ user_id: user.id, component_id: component.id });

        // Update likes_count in components table
        await supabase
          .from('components')
          .update({ likes_count: (likesCount || 0) + 1 })
          .eq('id', component.id);

        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
      onLike?.();
    } catch (error) {
      toast.error('Failed to update like');
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('Please sign in to save components');
      return;
    }

    try {
      if (isSaved) {
        await supabase
          .from('saved_components')
          .delete()
          .eq('user_id', user.id)
          .eq('component_id', component.id);

        // Update saves_count in components table
        await supabase
          .from('components')
          .update({ saves_count: (savesCount || 1) - 1 })
          .eq('id', component.id);

        setIsSaved(false);
        setSavesCount(prev => prev - 1);
      } else {
        await supabase
          .from('saved_components')
          .insert({ user_id: user.id, component_id: component.id });

        // Update saves_count in components table
        await supabase
          .from('components')
          .update({ saves_count: (savesCount || 0) + 1 })
          .eq('id', component.id);

        setIsSaved(true);
        setSavesCount(prev => prev + 1);
      }
      onSave?.();
    } catch (error) {
      toast.error('Failed to update save');
    }
  };

  return (
    <>
      <Card className="backdrop-blur-md bg-white/10 border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={component.profiles?.avatar_url || ''} />
                <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-white">
                  {component.profiles?.full_name || 'Anonymous'}
                </p>
                <p className="text-xs text-gray-300">
                  {new Date(component.created_at!).toLocaleDateString()}
                </p>
              </div>
            </div>
            {onExpand && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onExpand}
                className="text-white hover:bg-white/10"
              >
                <Eye className="h-4 w-4" />
              </Button>
              
            )}
            
              {user?.id === component.user_id && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="ml-2"
              >
                Delete
              </Button>
            )}
        
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">{component.title}</h3>
            {component.description && (
              <p className="text-sm text-gray-300 mb-3">{component.description}</p>
            )}
            <div className="flex flex-wrap gap-1">
              {component.tags?.map((tag, index) => (
                <Badge key={index} variant="secondary" className="bg-white/10 text-white border-white/20">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="rounded-lg overflow-hidden flex-1 relative">
              <SyntaxHighlighter
                language="jsx"
                style={tomorrow}
                customStyle={{
                  margin: 0,
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  maxHeight: '200px',
                  minHeight: '60px',
                  transition: 'max-height 0.3s',
                  overflow: 'auto'
                }}
              >
                {component.code}
              </SyntaxHighlighter>
              <div className="absolute top-2 right-5 flex gap-2 z-10">
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs"
                  onClick={() => setShowModal(true)}
                >
                  Expand
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs"
                  onClick={handleCopy}
                >
                  Copy
                </Button>
              </div>
            </div>
      
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                className={`text-white hover:bg-white/10 ${isLiked ? 'text-red-400' : ''}`}
              >
                <Heart className={`h-4 w-4 mr-1 ${isLiked ? 'fill-current' : ''}`} />
                {/* {likesCount} */}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSave}
                className={`text-white hover:bg-white/10 ${isSaved ? 'text-yellow-400' : ''}`}
              >
                <Bookmark className={`h-4 w-4 mr-1 ${isSaved ? 'fill-current' : ''}`} />
                {/* {savesCount} */}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floating Modal for Expanded Code */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
              onClick={() => setShowModal(false)}
            >
              ✕
            </button>
            <h2 className="text-lg font-bold mb-4">Code Snippet</h2>
            <div className="mb-4">
              <SyntaxHighlighter
                language="jsx"
                style={tomorrow}
                customStyle={{
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  maxHeight: '60vh',
                  overflow: 'auto',
                  background: '#1a1a1a',
                  color: '#fff'
                }}
              >
                {component.code}
              </SyntaxHighlighter>
            </div>
            <Button
              onClick={handleCopy}
              className="w-full"
            >
              Copy Code
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default ComponentCard;

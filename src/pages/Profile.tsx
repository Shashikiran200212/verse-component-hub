
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ComponentCard from '@/components/ComponentCard';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Edit, Bookmark, Code } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Component = Tables<'components'> & {
  profiles: Tables<'profiles'> | null;
  is_liked?: boolean;
  is_saved?: boolean;
};

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<Tables<'profiles'> | null>(null);
  const [userComponents, setUserComponents] = useState<Component[]>([]);
  const [savedComponents, setSavedComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchUserData();
  }, [user, navigate]);

  const fetchUserData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('Fetching user data...');

      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setUserProfile(profile);

      // Fetch user's components (without join)
      const { data: components, error: componentsError } = await supabase
        .from('components')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (componentsError) {
        console.error('User components error:', componentsError);
      }

      console.log('Fetched user components:', components?.length || 0, 'components');
      
      // Add profile data to components
      const userComponentsData: Component[] = (components || []).map((component) => ({
        ...component,
        profiles: profile || null
      }));
      
      setUserComponents(userComponentsData);

      // Fetch saved components
      const { data: savedComponentIds, error: savedError } = await supabase
        .from('saved_components')
        .select('component_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (savedError) {
        console.error('Saved components error:', savedError);
      }

      if (savedComponentIds && savedComponentIds.length > 0) {
        const componentIds = savedComponentIds.map(item => item.component_id);
        
        // Fetch the actual saved components
        const { data: savedComponentsData, error: savedComponentsError } = await supabase
          .from('components')
          .select('*')
          .in('id', componentIds);

        if (savedComponentsError) {
          console.error('Saved components data error:', savedComponentsError);
        }

        if (savedComponentsData && savedComponentsData.length > 0) {
          // Fetch profiles for saved components
          const userIds = [...new Set(savedComponentsData.map(c => c.user_id))];
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .in('id', userIds);

          // Create a map of profiles by user_id
          const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

          const savedComponentsWithProfiles: Component[] = savedComponentsData.map((component) => ({
            ...component,
            profiles: profilesMap.get(component.user_id) || null,
            is_saved: true
          }));

          console.log('Saved components:', savedComponentsWithProfiles);
          setSavedComponents(savedComponentsWithProfiles);
        } else {
          setSavedComponents([]);
        }
      } else {
        setSavedComponents([]);
      }
      
      console.log('Data fetching completed');
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="backdrop-blur-md bg-white/10 border-white/20 rounded-xl p-8 mb-8">
          <div className="flex items-center space-x-6 mb-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={userProfile?.avatar_url || user.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-2xl">
                <User className="h-12 w-12" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">
                {userProfile?.full_name || user.user_metadata?.full_name || 'Anonymous User'}
              </h1>
              <p className="text-gray-300 mb-2">{user.email}</p>
              {userProfile?.bio && (
                <p className="text-gray-400">{userProfile.bio}</p>
              )}
            </div>
            <Button
              variant="outline"
              className="border-white/20 text-black hover:bg-white/10"
              onClick={() => navigate('/edit-profile')}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">{userComponents.length}</p>
              <p className="text-gray-300">Components</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{savedComponents.length}</p>
              <p className="text-gray-300">Saved</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {userComponents.reduce((sum, comp) => sum + (comp.likes_count || 0), 0)}
              </p>
              <p className="text-gray-300">Total Likes</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="published" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/10 border-white/20">
            <TabsTrigger value="published" className="data-[state=active]:bg-white/20 text-white">
              <Code className="h-4 w-4 mr-2" />
              Published ({userComponents.length})
            </TabsTrigger>
            <TabsTrigger value="saved" className="data-[state=active]:bg-white/20 text-white">
              <Bookmark className="h-4 w-4 mr-2" />
              Saved ({savedComponents.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="published" className="mt-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="animate-pulse">
                    <div className="backdrop-blur-md bg-white/10 border-white/20 rounded-lg h-96"></div>
                  </div>
                ))}
              </div>
            ) : userComponents.length === 0 ? (
              <div className="text-center py-12">
                <Code className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No components yet</h3>
                <p className="text-gray-400 mb-4">Start sharing your amazing UI components!</p>
                <Button
                  onClick={() => navigate('/publish')}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                >
                  Publish Your First Component
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userComponents.map((component) => (
                  <ComponentCard
                    key={component.id}
                    component={component}
                    onLike={fetchUserData}
                    onSave={fetchUserData}
                    onDelete={fetchUserData}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="saved" className="mt-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="animate-pulse">
                    <div className="backdrop-blur-md bg-white/10 border-white/20 rounded-lg h-96"></div>
                  </div>
                ))}
              </div>
            ) : savedComponents.length === 0 ? (
              <div className="text-center py-12">
                <Bookmark className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No saved components</h3>
                <p className="text-gray-400 mb-4">Discover and save components you love!</p>
                <Button
                  onClick={() => navigate('/')}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                >
                  Explore Components
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedComponents.map((component) => (
                  <ComponentCard
                    key={component.id}
                    component={component}
                    onLike={fetchUserData}
                    onSave={fetchUserData}
                    onDelete={fetchUserData}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Profile;

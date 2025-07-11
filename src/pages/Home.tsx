
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ComponentCard from '@/components/ComponentCard';
import Navbar from '@/components/Navbar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, TrendingUp, Clock, Bookmark } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Component = Tables<'components'> & {
  profiles: Tables<'profiles'> | null;
  is_liked?: boolean;
  is_saved?: boolean;
};

const Home = () => {
  const { user } = useAuth();
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'trending' | 'saved'>('newest');

  useEffect(() => {
    fetchComponents();
  }, [sortBy, user]);

  const fetchComponents = async () => {
    try {
      setLoading(true);
      
      if (sortBy === 'saved' && user) {
        // For saved components, fetch saved components first
        const { data: savedData, error: savedError } = await supabase
          .from('saved_components')
          .select('component_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (savedError) {
          console.error('Saved components error:', savedError);
          throw savedError;
        }

        if (savedData && savedData.length > 0) {
          const componentIds = savedData.map(item => item.component_id);
          
          // Fetch the actual components
          const { data: componentsData, error: componentsError } = await supabase
            .from('components')
            .select('*')
            .in('id', componentIds);

          if (componentsError) {
            console.error('Components error:', componentsError);
            throw componentsError;
          }

          // Fetch profiles separately
          const userIds = componentsData?.map(c => c.user_id) || [];
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .in('id', userIds);

          // Create a map of profiles by user_id
          const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

          // Combine components with profiles
          const savedComponents: Component[] = (componentsData || []).map((component) => ({
            ...component,
            profiles: profilesMap.get(component.user_id) || null,
            is_saved: true
          }));

          // Check likes for saved components
          if (savedComponents.length > 0) {
            const { data: likesData } = await supabase
              .from('likes')
              .select('component_id')
              .eq('user_id', user.id)
              .in('component_id', componentIds);

            const likedIds = new Set(likesData?.map(l => l.component_id) || []);
            
            setComponents(savedComponents.map(component => ({
              ...component,
              is_liked: likedIds.has(component.id)
            })));
          } else {
            setComponents([]);
          }
        } else {
          setComponents([]);
        }
      } else {
        // For regular components feed - fetch components without join
        let query = supabase
          .from('components')
          .select('*');

        if (sortBy === 'trending') {
          query = query.order('likes_count', { ascending: false });
        } else {
          query = query.order('created_at', { ascending: false });
        }

        const { data: componentsData, error } = await query;

        if (error) {
          console.error('Components fetch error:', error);
          throw error;
        }

        console.log('Fetched components:', componentsData);

        if (componentsData && componentsData.length > 0) {
          // Fetch profiles separately
          const userIds = [...new Set(componentsData.map(c => c.user_id))];
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .in('id', userIds);

          // Create a map of profiles by user_id
          const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

          // Combine components with profiles
          const componentsWithProfiles: Component[] = componentsData.map((component) => ({
            ...component,
            profiles: profilesMap.get(component.user_id) || null
          }));

          // Check if components are liked/saved by current user
          if (user) {
            const componentIds = componentsData.map(c => c.id);
            
            const [likesResult, savesResult] = await Promise.all([
              supabase
                .from('likes')
                .select('component_id')
                .eq('user_id', user.id)
                .in('component_id', componentIds),
              supabase
                .from('saved_components')
                .select('component_id')
                .eq('user_id', user.id)
                .in('component_id', componentIds)
            ]);

            const likedIds = new Set(likesResult.data?.map(l => l.component_id) || []);
            const savedIds = new Set(savesResult.data?.map(s => s.component_id) || []);

            setComponents(componentsWithProfiles.map(component => ({
              ...component,
              is_liked: likedIds.has(component.id),
              is_saved: savedIds.has(component.id)
            })));
          } else {
            setComponents(componentsWithProfiles);
          }
        } else {
          setComponents([]);
        }
      }
    } catch (error) {
      console.error('Error fetching components:', error);
      toast.error('Failed to load components');
      setComponents([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredComponents = components.filter(component =>
    component.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    component.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    component.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4 text-left">
            Discover Amazing UI 
          </h1>
          <p className="text-gray-300 text-left mb-8">
            Explore, save, and share beautiful UI components with the community
          </p>
          
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search components..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400"
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={sortBy === 'newest' ? 'default' : 'ghost'}
                onClick={() => setSortBy('newest')}
                className="text-white hover:bg-white/10"
              >
                <Clock className="h-4 w-4 mr-2" />
                Newest
              </Button>
              <Button
                variant={sortBy === 'trending' ? 'default' : 'ghost'}
                onClick={() => setSortBy('trending')}
                className="text-white hover:bg-white/10"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Trending
              </Button>
              {user && (
                <Button
                  variant={sortBy === 'saved' ? 'default' : 'ghost'}
                  onClick={() => setSortBy('saved')}
                  className="text-white hover:bg-white/10"
                >
                  <Bookmark className="h-4 w-4 mr-2" />
                  Saved
                </Button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="backdrop-blur-md bg-white/10 border-white/20 rounded-lg h-96"></div>
              </div>
            ))}
          </div>
        ) : filteredComponents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-300 text-lg">
              {sortBy === 'saved' ? 'No saved components yet' : 'No components found'}
            </p>
            <p className="text-gray-400 mt-2">
              {sortBy === 'saved' 
                ? 'Start saving components to see them here' 
                : 'Try adjusting your search terms'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredComponents.map((component) => (
              <ComponentCard
                key={component.id}
                component={component}
                onLike={fetchComponents}
                onSave={fetchComponents}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;

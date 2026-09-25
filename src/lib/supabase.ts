import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zmmvqvlazvfwmrdavrta.supabase.co'

const supabaseAnonKey = 'sb_publishable_YGDDHalRrK-8nrnwbO6ERA_kJLHgfD4'

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)

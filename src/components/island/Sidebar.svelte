<script lang="ts">
import * as Collapsible from "$lib/components/ui/collapsible/index.js";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import MinusIcon from "@lucide/svelte/icons/minus";
import PlusIcon from "@lucide/svelte/icons/plus";
import SidebarProvider from "$lib/components/ui/sidebar/sidebar-provider.svelte";


const { routes = [], currentSlug = "", ...restProps } = $props<{
    routes?: string[];
    currentSlug?: string;
}>();


interface Node {
    name: string;
    type: "file" | "directory";
    slug: string;
    children: Node[];
}

function flatten(map: Map<string, { node: Node; map: Map<string, any> }>): Node[] {

    return Array.from(map.values())
        .sort((a, b) => {
            if (a.node.type !== b.node.type) return a.node.type === "file" ? -1 : 1;
            return a.node.name.localeCompare(b.node.name);
        })
        .map((entry) => {
            entry.node.children = flatten(entry.map);
            return entry.node;
        });

}

function buildTree(routes: string[]): Node[] {
    const root = new Map<string, { node: Node; map: Map<string, any> }>()

    
    for (const route of routes) {
            const clean = route.replace(/^\.+\//, "").replace(/\.txt$/, "");
        const segments = clean.split("/").filter(Boolean).slice(2); // strips `.wiki/wiki/`
        let currentMap = root;

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const slug = segments.slice(0, i + 1).join("/");
            const isFile = i === segments.length - 1;
            
            if (!currentMap.has(seg)) {
                currentMap.set(seg, {
                node: {
                    name: seg,
                    type: isFile ? "file" : "directory",
                    slug,
                    children: [],
                },
                map: new Map(),
                });
            }

            if (!isFile) {
                currentMap = currentMap.get(seg)!.map;
            }
        }
    }   

    return flatten(root)

}



const tree = $derived(buildTree(routes));


function hasActive(node: Node): boolean {
    if (node.type === "file" && node.slug === currentSlug) return true;
    if (node.type === "directory") return node.children.some(hasActive);
    return false;
}

const openPaths = $derived.by(() => {
    const set = new Set<string>();
    function walk(nodes: Node[]) {
        for (const n of nodes) {
            if (n.type === "directory" && n.children.some(hasActive)) {
                set.add(n.slug);
                walk(n.children);
            }
        }
    }
    walk(tree);
    return set;
});

function isOpen(slug: string) {
    return openPaths.has(slug);
}
</script>


{#snippet renderTopLevel(node: Node)}
    {#if node.type === "directory"}
        <Collapsible.Root open={isOpen(node.slug)} class="group/collapsible">
            <Sidebar.MenuItem>

                <Collapsible.Trigger>
                    {#snippet child({ props })}
                        <Sidebar.MenuButton {...props}>
                            {node.name}
                            <PlusIcon class="ms-auto group-data-[state=open]/collapsible:hidden" />
                            <MinusIcon class="ms-auto group-data-[state=closed]/collapsible:hidden" />
                        </Sidebar.MenuButton>
                    {/snippet}
                </Collapsible.Trigger>

                <Collapsible.Content>
                    <Sidebar.MenuSub>
                        {#each node.children as child (child.slug)}
                            {#if child.type === "directory"}
                                <Collapsible.Root open={isOpen(child.slug)} class="group/collapsible">
                                    <Sidebar.MenuSubItem>
                                        <Collapsible.Trigger>
                                            {#snippet child({ props })}
                                                    <Sidebar.MenuSubButton {...props}>
                                                    {child.name}
                                                    <PlusIcon class="ms-auto group-data-[state=open]/collapsible:hidden" />
                                                    <MinusIcon class="ms-auto group-data-[state=closed]/collapsible:hidden" />
                                                    </Sidebar.MenuSubButton>
                                            {/snippet}
                                        </Collapsible.Trigger>

                                        <Collapsible.Content>
                                            <Sidebar.MenuSub>
                                                {#each child.children as grandchild (grandchild.slug)}
                                                    <Sidebar.MenuSubItem>
                                                        <Sidebar.MenuSubButton isActive={grandchild.slug === currentSlug}>
                                                            {#snippet child({ props })}
                                                                <a href={"/wiki/" + grandchild.slug} {...props}>{grandchild.name}</a>
                                                            {/snippet}
                                                        </Sidebar.MenuSubButton>
                                                    </Sidebar.MenuSubItem>
                                                {/each}

                                            </Sidebar.MenuSub>
                                        </Collapsible.Content>
                                    </Sidebar.MenuSubItem>
                                </Collapsible.Root>
                            {:else}
                                <Sidebar.MenuSubItem>
                                    <Sidebar.MenuSubButton isActive={child.slug === currentSlug}>
                                        {#snippet child({ props })}
                                            <a href={"/wiki/" + child.slug} {...props}>{child.name}</a>
                                        {/snippet}
                                    </Sidebar.MenuSubButton>
                                </Sidebar.MenuSubItem>
                            {/if}
                        {/each}
                    </Sidebar.MenuSub>
                </Collapsible.Content>
            </Sidebar.MenuItem>
        </Collapsible.Root>
    {:else}
        <Sidebar.MenuItem>
            <Sidebar.MenuButton isActive={node.slug === currentSlug}>
                {#snippet child({ props })}
                    <a href={"/wiki/" + node.slug} {...props}>{node.name}</a>
                {/snippet}
            </Sidebar.MenuButton>
        </Sidebar.MenuItem>
    {/if}
{/snippet}


<SidebarProvider>
 <Sidebar.Root {...restProps}>
<Sidebar.Content>
    <Sidebar.Group>
        <Sidebar.Menu>
            {#each tree as node (node.slug)}
                {@render renderTopLevel(node)}
            {/each}
        </Sidebar.Menu>
    </Sidebar.Group>
</Sidebar.Content>
</Sidebar.Root>
</SidebarProvider>
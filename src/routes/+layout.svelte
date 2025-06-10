<script>
	import { onMount } from 'svelte';
	import '../app.css';
	import { ModeWatcher, setMode } from 'mode-watcher';
	onMount(() => {
		setMode('dark');
	});
	let { children } = $props();
</script>

<ModeWatcher />
{@render children?.()}
